import Dom                from './Dom';
import Util               from './Util';
import Markup             from './models/Markup';
import TomeNode           from './models/TomeNode';
import Caret              from './models/Caret';
import TomeSelection      from './models/TomeSelection';
import State              from './models/State';
import Action             from './models/Action';
import IAction            from './interfaces/IAction';
import ISelection         from './interfaces/ISelection';
import ConfigRoot         from './config/ConfigRoot';
import EventManager       from './EventManager';
import TreeBuilder        from './TreeBuilder';
import Renderer           from './Renderer';
import reducer            from './reducer';
import ActionType         from './constants/ActionType';
import MarkupTag          from './constants/MarkupTag';
import SelectionDirection from './constants/SelectionDirection';
import INodeLike          from './interfaces/INodeLike';
import ITome              from './interfaces/ITome';
import DiffPatch          from './DiffPatch';

class Tome implements ITome {
    dom:          Dom          = new Dom();
    eventManager: EventManager = new EventManager(this);
    config:       ConfigRoot   = new ConfigRoot();
    root:         TomeNode     = null;
    history:      Array<State> = [];
    historyIndex: number       = -1;
    lastRender:   string       = '';

    constructor(el: HTMLElement, config: any) {
        this.init(el, config);
    }

    get state() {
        return this.history[this.historyIndex];
    }

    init(el: HTMLElement, config: any): void {
        Util.extend(this.config, config, true);

        if (!el.contentEditable) {
            el.contentEditable = true.toString();
        }

        this.dom.root = el;

        this.history.push(this.buildInitialState(this.config.value));

        this.historyIndex++;

        this.render();

        this.eventManager.bindEvents(this.dom.root);
    }

    buildInitialState(initialState: any): State {
        const state: State = Util.extend(new State(), initialState);

        if (state.markups.length < 1) {
            state.markups.push(new Markup([MarkupTag.P, 0, 0]));
        }

        // TODO: if text but no markups, wrap entire in <p>

        // Coerce triplets into `Markup` if needed

        state.markups = state.markups.map(markup => Array.isArray(markup) ? new Markup(markup) : markup);

        return state;
    }

    render(): void {
        this.root = Tome.buildModelFromState(this.state);

        const nextRender = Renderer.renderNodes(this.root.childNodes);

        if (!this.lastRender) {
            // Initial render

            this.dom.root.innerHTML = this.lastRender = nextRender;

            return;
        }

        const prevRender = this.lastRender;

        const diffCommand = DiffPatch.diff(`<div>${prevRender}</div>`, `<div>${nextRender}</div>`);

        DiffPatch.patch(this.dom.root, diffCommand);

        this.lastRender = nextRender;
    }

    undo(): void {
        if (this.historyIndex === 1) return;

        const fn = this.config.callbacks.onStateChange;

        this.historyIndex--;

        this.render();

        this.positionCaret(this.state.selection);

        if (typeof fn === 'function') {
            fn(this.state, ActionType.UNDO);
        }
    }

    redo(): void {
        if (this.history.length - 1 === this.historyIndex) return;

        const fn = this.config.callbacks.onStateChange;

        this.historyIndex++;

        this.render();

        this.positionCaret(this.state.selection);

        if (typeof fn === 'function') {
            fn(this.state, ActionType.REDO);
        }
    }

    applyAction(actionRaw: IAction): void {
        const action: Action = Object.assign(new Action(), actionRaw);
        const fn = this.config.callbacks.onStateChange;

        if (action.type === ActionType.SET_SELECTION) {
            // Detect new selection from browser API

            const selection = window.getSelection();

            if (!selection.anchorNode || !this.dom.root.contains(selection.anchorNode)) return;

            action.range = this.getRangeFromSelection(selection);
        } else {
            // Use previous range

            action.range = this.state.selection;
        }

        const nextState = [action].reduce(reducer, this.state);

        if (!(nextState instanceof State)) {
            throw new TypeError(`[Tome] Action type "${action.type.toString()}" did not return a valid state object`);
        }

        if (nextState === this.state) return;

        Object.freeze(nextState);
        Object.freeze(nextState.markups);
        Object.freeze(nextState.activeInlineMarkups);
        Object.freeze(nextState.envelopedBlockMarkups);

        // TODO: discern between 'push' vs 'replace' commands i.e. inserting a
        // char vs moving a cursor

        // Chop off any divergent future state

        this.history.length = this.historyIndex + 1;

        // Push in new state

        this.history.push(nextState);

        this.historyIndex++;

        if (action.type !== ActionType.SET_SELECTION) {
            this.render();

            this.positionCaret(this.state.selection);
        }

        if (typeof fn === 'function') {
            fn(this.state, action.type);
        }
    }

    getPathFromDomNode(domNode: Node): Array<number> {
        const path = [];

        while (domNode) {
            if (domNode instanceof HTMLElement && domNode === this.dom.root) break;

            path.unshift(Util.index(domNode, true));

            domNode = domNode.parentElement;
        }

        return path;
    }

    getNodeByPath<T extends INodeLike>(path: Array<number>, root: T): T {
        let node: T = root;
        let index = -1;
        let i = 0;

        while (typeof (index = path[i]) === 'number') {
            node = node.childNodes[index];

            i++;
        }

        return node || null;
    }

    /**
     * @param   {Selection} selection
     * @return  {TomeSelection;}
     */

    getRangeFromSelection(selection: Selection) {
        const anchorPath = this.getPathFromDomNode(selection.anchorNode);
        const virtualAnchorNode = this.getNodeByPath(anchorPath, this.root);
        const from = new Caret();
        const to = new Caret();

        let extentPath = anchorPath;
        let virtualExtentNode: TomeNode = virtualAnchorNode;
        let isRtl = false;
        let rangeFrom = -1;
        let rangeTo = -1;

        if (!selection.isCollapsed) {
            extentPath = this.getPathFromDomNode(selection.extentNode);
            virtualExtentNode = this.getNodeByPath(extentPath, this.root);
        }

        // If the anchor is greater than the extent, or both paths are equal
        // but the anchor offset is greater than the extent offset, the range
        // should be considered "RTL"

        isRtl =
            Util.isGreaterPath(anchorPath, extentPath) ||
            (!Util.isGreaterPath(extentPath, anchorPath) && selection.anchorOffset > selection.extentOffset);

        from.node   = to.node = isRtl ? virtualExtentNode : virtualAnchorNode;
        from.offset = to.offset = isRtl ? selection.extentOffset : selection.anchorOffset;
        from.path   = to.path = isRtl ? extentPath : anchorPath;

        if (!selection.isCollapsed) {
            to.node     = isRtl ? virtualAnchorNode : virtualExtentNode;
            to.offset   = isRtl ? selection.anchorOffset : selection.extentOffset;
            to.path     = isRtl ? anchorPath : extentPath;
        }

        rangeFrom = Math.min(from.node.start + from.offset, from.node.end);
        rangeTo = Math.min(to.node.start + to.offset, to.node.end);

        return new TomeSelection(rangeFrom, rangeTo, isRtl ? SelectionDirection.RTL : SelectionDirection.LTR);
    }

    positionCaret({from, to, direction}: ISelection): void {
        const range = document.createRange();
        const selection = window.getSelection();

        let childNodes:  Array<TomeNode> = this.root.childNodes;
        let virtualNode: TomeNode;
        let nodeLeft:    Node;
        let nodeRight:   Node;
        let offsetStart: number;
        let offsetEnd:   number;

        for (let i = 0; (virtualNode = childNodes[i]); i++) {
            // Node ends before caret

            if (virtualNode.end < from) continue;

            // The desired node is this node, or within this node

            if (virtualNode.childNodes.length) {
                // Node has children, drop down until at leaf

                childNodes = virtualNode.childNodes;

                i = -1;

                continue;
            }

            // At leaf

            offsetStart = from - virtualNode.start;

            break;
        }

        nodeLeft = this.getNodeByPath(virtualNode.path, this.dom.root);

        range.setStart(nodeLeft, offsetStart);

        if (from === to) {
            // Single caret

            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);

            return;
        }

        // Multi-character selection, reset child nodes

        childNodes = this.root.childNodes;

        for (let i = 0; (virtualNode = childNodes[i]); i++) {
            if (virtualNode.end < to) continue;

            if (virtualNode.childNodes.length) {
                childNodes = virtualNode.childNodes;

                i = -1;

                continue;
            }

            offsetEnd = to - virtualNode.start;

            break;
        }

        nodeRight = this.getNodeByPath(virtualNode.path, this.dom.root);

        range.setEnd(nodeRight, offsetEnd);

        selection.removeAllRanges();

        if (direction === SelectionDirection.LTR) {
            selection.setBaseAndExtent(nodeRight, offsetEnd, nodeLeft, offsetStart);
        } else {
            selection.setBaseAndExtent(nodeLeft, offsetStart, nodeRight, offsetEnd);
        }
    }

    static buildModelFromState(state: State): TomeNode {
        const root = new TomeNode();

        TreeBuilder.build(root, state.text, state.markups);

        return root;
    }
}

export default Tome;
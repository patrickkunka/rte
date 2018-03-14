import ITome                   from '../Tome/Interfaces/ITome';
import Caret                   from '../Tree/Caret';
import TomeNode                from '../Tree/TomeNode';
import Util                    from '../Util/Util';
import Action                  from './Action';
import ActionType              from './Constants/ActionType';
import HistoryManipulationType from './Constants/HistoryManipulationType';
import SelectionDirection      from './Constants/SelectionDirection';
import createStateFromAction   from './createStateFromAction';
import IAction                 from './Interfaces/IAction';
import IValue                  from './Interfaces/IValue';
import State                   from './State';
import TomeSelection           from './TomeSelection';

class StateManager {
    private lastActionType:   ActionType = null;
    private history:          State[]    = [];
    private historyIndex:     number     = -1;
    private tome:             ITome      = null;
    private canPushState:     boolean    = true;
    private timerIdBlockPush: number     = null;
    private timerIdBackup:    number     = null;

    private static DURATION_BLOCK_PUSH = 750;
    private static DURATION_BACKUP     = 2000;

    public get state(): State {
        return this.history[this.historyIndex];
    }

    constructor(tome: ITome) {
        this.tome = tome;
    }

    public init(initialValue: IValue) {
        this.pushStateToHistory(new State(initialValue));
    }

    public undo(): void {
        if (this.historyIndex === 0) return;

        const fn = this.tome.config.callbacks.onStateChange;
        const prevState = this.state;

        this.historyIndex--;

        this.tome.eventManager.raiseIsActioningFlag();

        this.renderTreeToDom(prevState);

        if (typeof fn === 'function') {
            fn(this.state, ActionType.UNDO);
        }

        if (this.tome.config.debug.enable) {
            console.info(`UNDO (${this.historyIndex})`);
        }
    }

    public redo(): void {
        if (this.history.length - 1 === this.historyIndex) return;

        const fn = this.tome.config.callbacks.onStateChange;
        const prevState = this.state;

        this.historyIndex++;

        this.tome.eventManager.raiseIsActioningFlag();

        this.renderTreeToDom(prevState);

        if (typeof fn === 'function') {
            fn(this.state, ActionType.REDO);
        }

        if (this.tome.config.debug.enable) {
            console.info(`REDO (${this.historyIndex})`);
        }
    }

    public applyAction(actionRaw: IAction): void {
        const action: Action = Object.assign(new Action(), actionRaw);
        const fn = this.tome.config.callbacks.onStateChange;

        let manipulation: HistoryManipulationType = HistoryManipulationType.PUSH;

        if (action.type === ActionType.SET_SELECTION) {
            // Detect new selection from browser API

            const selection = window.getSelection();

            if (!selection.anchorNode || !this.tome.dom.root.contains(selection.anchorNode)) return;

            action.range = this.getRangeFromSelection(selection);

            if (action.range.from === this.state.selection.from && action.range.to === this.state.selection.to) return;
        } else if (action.range) {
            // A range has been set, coerce to type

            action.range = Object.assign(new TomeSelection(), action.range);
        } else {
            // Use previous range

            action.range = this.state.selection;
        }

        manipulation = this.getManipulationTypeForActionType(action);

        const prevState = this.state;
        const nextState = createStateFromAction(prevState, action);

        if (!(nextState instanceof State)) {
            throw new TypeError(`[Tome] Action type "${action.type.toString()}" did not return a valid state object`);
        }

        if (nextState === this.state) return;

        Object.freeze(nextState);
        Object.freeze(nextState.markups);
        Object.freeze(nextState.activeInlineMarkups);
        Object.freeze(nextState.envelopedBlockMarkups);

        // Chop off any divergent future state

        this.history.length = this.historyIndex + 1;

        // Push in new state

        switch (manipulation) {
            case HistoryManipulationType.PUSH:
                this.pushStateToHistory(nextState);

                break;
            case HistoryManipulationType.REPLACE:
                this.history[this.history.length - 1] = nextState;

                break;
        }

        this.lastActionType = action.type;

        if (
            [
                ActionType.CHANGE_BLOCK_TYPE,
                ActionType.INSERT_CUSTOM_BLOCK
            ].includes(action.type)
        ) {
            // Theses events will trigger `selectionchange` or `mutations` events.
            // Momentarily raise the `isActioning` flag to prevent it from being handled.

            this.tome.eventManager.raiseIsActioningFlag();
        }

        if (action.type !== ActionType.SET_SELECTION && action.type !== ActionType.MUTATE) {
            this.renderTreeToDom(prevState);
        } else if (action.type === ActionType.MUTATE) {
            // Update internal tree only, but do not render.

            this.tome.tree.render();
        }

        if (typeof fn === 'function') {
            fn(this.state, action.type);
        }

        if (this.tome.config.debug.enable) {
            console.info(`${manipulation} (${this.historyIndex}): ${action.type}`);
        }
    }

    private resetCanPushTimer() {
        clearTimeout(this.timerIdBlockPush);

        this.canPushState = false;

        this.timerIdBlockPush = window.setTimeout(
            () => this.allowPush(),
            StateManager.DURATION_BLOCK_PUSH
        );

        if (this.timerIdBackup !== null) return;

        this.timerIdBackup = window.setTimeout(() => {
            this.allowPush();

            this.timerIdBackup = null;
        }, StateManager.DURATION_BACKUP);
    }

    private allowPush() {
        this.canPushState = true;
    }

    private pushStateToHistory(nextState) {
        const {limit} = this.tome.config.history;

        if (this.historyIndex < limit - 1) {
            this.history.push(nextState);

            this.historyIndex++;
        } else {
            this.history.shift();
            this.history.push(nextState);
        }
    }

    private getManipulationTypeForActionType(action: Action): HistoryManipulationType {
        switch (action.type) {
            case ActionType.INSERT:
                if (
                    [
                        ActionType.DELETE,
                        ActionType.BACKSPACE,
                        ActionType.CUT
                    ].indexOf(this.lastActionType) > -1 ||
                    this.canPushState
                ) {
                    break;
                }

                this.resetCanPushTimer();

                return HistoryManipulationType.REPLACE;
            case ActionType.DELETE:
            case ActionType.BACKSPACE:
                if (
                    [
                        ActionType.INSERT,
                        ActionType.PASTE
                    ].indexOf(this.lastActionType) > -1 ||
                    this.canPushState
                ) {
                    break;
                }

                this.resetCanPushTimer();

                return HistoryManipulationType.REPLACE;
            case ActionType.SET_SELECTION:
                const {type} = action.data;

                if (type === 'keydown') {
                    return HistoryManipulationType.REPLACE;
                }

                return HistoryManipulationType.PUSH;
            case ActionType.TOGGLE_INLINE:
                if (action.range.isCollapsed) {
                    return HistoryManipulationType.REPLACE;
                }

                return HistoryManipulationType.PUSH;
        }

        this.resetCanPushTimer();

        return HistoryManipulationType.PUSH;
    }

    private getRangeFromSelection(selection: Selection): TomeSelection {
        const anchorPath = this.tome.dom.getPathFromDomNode(selection.anchorNode);
        const {root} = this.tome.tree;
        const from = new Caret();
        const to = new Caret();

        let virtualAnchorNode = Util.getNodeByPath(anchorPath, root);
        let anchorOffset = selection.anchorOffset;
        let extentOffset = selection.extentOffset;

        if ((virtualAnchorNode.isBlock || virtualAnchorNode.isListItem) && anchorOffset > 0) {
            // Caret is lodged between a safety <br> and
            // the end of block

            const childIndex = Math.min(virtualAnchorNode.childNodes.length - 1, anchorOffset);

            virtualAnchorNode = virtualAnchorNode.childNodes[childIndex];
            anchorOffset = virtualAnchorNode.text.length;
        }

        if (virtualAnchorNode.isText && virtualAnchorNode.parent === root && anchorOffset > 0) {
            // Caret is lodged in a block break between blocks

            const [index] = anchorPath;

            virtualAnchorNode = root.childNodes[index + 1];
            anchorOffset = 0;
        }

        let extentPath = anchorPath;
        let virtualExtentNode: TomeNode = virtualAnchorNode;
        let isRtl = false;
        let rangeFrom = -1;
        let rangeTo = -1;

        if (!selection.isCollapsed) {
            extentPath = this.tome.dom.getPathFromDomNode(selection.extentNode);
            virtualExtentNode = Util.getNodeByPath(extentPath, root);

            if ((virtualExtentNode.isBlock || virtualExtentNode.isListItem) && extentOffset > 0) {
                const childIndex = Math.min(virtualExtentNode.childNodes.length - 1, extentOffset);

                virtualExtentNode = virtualExtentNode.childNodes[childIndex];
                extentOffset = virtualExtentNode.text.length;
            }
        }

        // If the anchor is greater than the extent, or both paths are equal
        // but the anchor offset is greater than the extent offset, the range
        // should be considered "RTL"

        isRtl =
            Util.isGreaterPath(anchorPath, extentPath) ||
            (!Util.isGreaterPath(extentPath, anchorPath) && selection.anchorOffset > selection.extentOffset);

        from.node   = to.node = isRtl ? virtualExtentNode : virtualAnchorNode;
        from.offset = to.offset = isRtl ? extentOffset : anchorOffset;
        from.path   = to.path = isRtl ? extentPath : anchorPath;

        if (!selection.isCollapsed) {
            to.node   = isRtl ? virtualAnchorNode : virtualExtentNode;
            to.offset = isRtl ? anchorOffset : extentOffset;
            to.path   = isRtl ? anchorPath : extentPath;
        }

        rangeFrom = Math.min(from.node.start + from.offset, from.node.end);
        rangeTo = Math.min(to.node.start + to.offset, to.node.end);

        return new TomeSelection(rangeFrom, rangeTo, isRtl ? SelectionDirection.RTL : SelectionDirection.LTR);
    }

    private renderTreeToDom(prevState: State) {
        try {
            this.tome.tree.render(true);

            this.tome.tree.positionCaret(this.state.selection);
        } catch (err) {
            if (this.tome.config.debug.enable) {
                console.error('[StateManager] Error while transitioning between states:', prevState, this.state);
            }

            throw err;
        }
    }
}

export default StateManager;
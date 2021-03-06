import ActionType    from '../State/Constants/ActionType';
import MarkupTag     from '../State/Constants/MarkupTag';
import IAction       from '../State/Interfaces/IAction';
import ITome         from '../Tome/Interfaces/ITome';
import Keypress      from './Constants/Keypress';
import MutationType  from './Constants/MutationType';
import EventBinding  from './EventBinding';
import IMEParser     from './IMEParser';
import IEventBinding from './Interfaces/IEventBinding';
import IEventManager from './Interfaces/IEventManager';
import IInputEvent   from './Interfaces/IInputEvent';
import bindEvent     from './Util/bindEvent';

const SELECTION_DELAY = 10;
const ACTION_DELAY = 500;

const EVENTS: Array<string|IEventBinding> = [
    'keypress',
    'keydown',
    'textInput',
    'compositionstart',
    'compositionupdate',
    'compositionend',
    'mousedown',
    'paste',
    'cut',
    {
        type: 'mouseup',
        target: window
    },
    {
        type: 'selectionchange',
        target: document,
        debounce: 200
    }
];

class EventManager implements IEventManager {
    private tome:               ITome            = null;
    private observer:           MutationObserver = null;
    private isComposing:        boolean          = false;
    private isActioning:        boolean          = false;
    private isActioningTimerId: number           = -1;
    private bindings:           EventBinding[]   = [];

    public get root() {
        return this.tome.dom.root;
    }

    constructor(tome: ITome) {
        const MutationObserver = (window as any).MutationObserver;

        this.tome = tome;
        this.observer = new MutationObserver((this.handleMutation.bind(this)));
    }

    public bindEvents(): void {
        this.bindings = EVENTS.map(bindEvent.bind(null, this, this.root));

        this.connectMutationObserver();
    }

    public unbindEvents(): void {
        this.bindings.forEach(binding => binding.unbind());

        this.disconnectMutationObserver();
    }

    public raiseIsActioningFlag(delay = ACTION_DELAY) {
        clearTimeout(this.isActioningTimerId);

        this.isActioning = true;

        this.isActioningTimerId = window.setTimeout(() => (this.isActioning = false), delay);
    }

    protected handleKeypress(e: KeyboardEvent): void {
        e.preventDefault();

        this.raiseIsActioningFlag();

        this.tome.stateManager.applyAction({type: ActionType.INSERT, content: e.key});
    }

    protected handleMouseup(e: MouseEvent): void {
        if (this.tome.dom.root !== document.activeElement) return;

        this.tome.stateManager.applyAction({type: ActionType.SET_SELECTION, data: e});
    }

    protected handleSelectionchange(e): void {
        // NB: This was determined the most effective way to detect
        // selection change on touch devices, however is firing in
        // reaction to programmatically seting the cursor position.
        // Currently blocked by isActioning flag, but needs further
        // investigation.

        if (this.tome.dom.root !== document.activeElement || this.isActioning) return;

        this.tome.stateManager.applyAction({type: ActionType.SET_SELECTION, data: e});
    }

    protected handleMousedown(e: MouseEvent): void {
        this.tome.stateManager.applyAction({type: ActionType.SET_SELECTION, data: e});
    }

    protected handlePaste(e: ClipboardEvent): void {
        const {clipboardData} = e;
        const text = clipboardData.getData('text/plain');
        const html = clipboardData.getData('text/html');

        this.raiseIsActioningFlag();

        this.tome.stateManager.applyAction({type: ActionType.PASTE, data: {text, html}});

        e.preventDefault();
    }

    protected handleCut(e: ClipboardEvent): void {
        document.execCommand('copy');

        this.raiseIsActioningFlag();

        this.tome.stateManager.applyAction({type: ActionType.CUT});

        e.preventDefault();
    }

    protected handleTextInput(e: IInputEvent): void {
        e.preventDefault();

        if (this.isComposing) {
            // Input as side effect of composition, ignore

            return;
        }

        if (e.data !== ' ') {
            this.raiseIsActioningFlag();
        }

        this.tome.stateManager.applyAction({type: ActionType.INSERT, content: e.data});
    }

    protected handleCompositionstart(): void {
        this.isComposing = true;
    }

    protected handleCompositionupdate(): void {
        this.isComposing = true;
    }

    protected handleCompositionend(): void {
        this.isComposing = false;
    }

    protected handleMutation(mutations: MutationRecord[]) : void {
        if (this.isActioning) return;

        top:
        for (const mutation of mutations) {
            let action: IAction = null;

            switch (mutation.type) {
                case MutationType.CHARACTER_DATA:
                    action = IMEParser.handleCharacterMutation(mutation, mutations, this.tome);

                    this.tome.stateManager.applyAction(action);

                    break;
                case MutationType.CHILD_LIST:
                    if (mutation.target !== this.tome.dom.root) break;

                    action = IMEParser.handleBlockMutation(mutation, mutations, this.tome);

                    if (action) this.tome.stateManager.applyAction(action);

                    break top;
            }
        }

        this.isActioning = true;

        setTimeout(() => (this.isActioning = false), SELECTION_DELAY);
    }

    protected handleKeydown(e: KeyboardEvent): void {
        const key = e.key.toLowerCase();

        if (key === Keypress.UNIDENTIFIED) {
            return;
        }

        let action: IAction = null;

        if (e.metaKey) {
            switch (key) {
                case Keypress.A:
                    action = {type: ActionType.SET_SELECTION, data: e};

                    break;
                case Keypress.B:
                    action = {type: ActionType.TOGGLE_INLINE, tag: MarkupTag.STRONG};

                    e.preventDefault();

                    break;
                case Keypress.I:
                    action = {type: ActionType.TOGGLE_INLINE, tag: MarkupTag.EM};

                    e.preventDefault();

                    break;
                case Keypress.X:
                    action = {type: ActionType.CUT};

                    e.preventDefault();

                    break;
                case Keypress.C:
                    action = {type: ActionType.COPY};

                    break;
                case Keypress.S:
                    action = {type: ActionType.SAVE};

                    e.preventDefault();

                    break;
                case Keypress.Z:
                    e.preventDefault();

                    e.shiftKey ? this.tome.redo() : this.tome.undo();

                    return;
                case Keypress.H:
                    action = {type: ActionType.CHANGE_BLOCK_TYPE, tag: MarkupTag.H1};

                    e.preventDefault();

                    break;
                case Keypress.K: {
                    const state = this.tome.getState();
                    const isLinkActive = state.isTagActive(MarkupTag.A);

                    e.preventDefault();

                    if (!isLinkActive) {
                        this.raiseIsActioningFlag();

                        this.tome.addInlineLink();

                        return;
                    }

                    action = {type: ActionType.TOGGLE_INLINE, tag: MarkupTag.A};

                    break;
                }
            }
        }

        switch (key) {
            case Keypress.ENTER:
                action = {type: e.shiftKey ? ActionType.INSERT_LINE_BREAK : ActionType.INSERT_BLOCK_BREAK};

                e.preventDefault();

                break;
            case Keypress.BACKSPACE:
                action = {type: ActionType.BACKSPACE};

                e.preventDefault();

                break;
            case Keypress.DELETE:
                action = {type: ActionType.DELETE};

                e.preventDefault();

                break;
            case Keypress.ARROW_LEFT:
            case Keypress.ARROW_RIGHT:
            case Keypress.ARROW_UP:
            case Keypress.ARROW_DOWN:
                action = {type: ActionType.SET_SELECTION, data: e};

                break;
        }

        if (!action || action.type === ActionType.NONE) return;

        this.raiseIsActioningFlag();

        setTimeout(() => this.tome.stateManager.applyAction(action), SELECTION_DELAY);
    }

    private connectMutationObserver() {
        this.observer.observe(this.root, {
            childList: true,
            characterData: true,
            characterDataOldValue: true,
            subtree: true
        });
    }

    private disconnectMutationObserver() {
        this.observer.disconnect();
    }
}

export default EventManager;
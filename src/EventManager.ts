import ActionType   from './constants/ActionType';
import Keypress     from './constants/Keypress';
import MarkupTag    from './constants/MarkupTag';
import MutationType from './constants/MutationType';
import IMEParser    from './IMEParser';
import IAction      from './interfaces/IAction';
import IAnchorData  from './interfaces/IAnchorData';
import ITome        from './interfaces/ITome';
import Util         from './Util';

const SELECTION_DELAY = 10;
const ACTION_DELAY = 100;

interface IInputEvent extends UIEvent {
    data: string;
}

class EventManager {
    public root: HTMLElement = null;

    private tome:           ITome               = null;
    private boundDelegator: EventListenerObject = null;
    private observer:       MutationObserver    = null;
    private isComposing:    boolean             = false;
    private isActioning:    boolean             = false;

    constructor(tome: ITome) {
        this.tome = tome;
        this.boundDelegator = this.delegator.bind(this);
        this.observer = new MutationObserver(this.handleMutation.bind(this));
    }

    public bindEvents(): void {
        this.root.addEventListener('keypress', this.boundDelegator);
        this.root.addEventListener('keydown', this.boundDelegator);
        this.root.addEventListener('textInput', this.boundDelegator);
        this.root.addEventListener('compositionstart', this.boundDelegator);
        this.root.addEventListener('compositionupdate', this.boundDelegator);
        this.root.addEventListener('compositionend', this.boundDelegator);
        this.root.addEventListener('mousedown', this.boundDelegator);
        this.root.addEventListener('paste', this.boundDelegator);

        window.addEventListener('mouseup', this.boundDelegator);

        this.connectMutationObserver();
    }

    public unbindEvents(): void {
        this.root.removeEventListener('keypress', this.boundDelegator);
        this.root.removeEventListener('keydown', this.boundDelegator);
        this.root.removeEventListener('textInput', this.boundDelegator);
        this.root.removeEventListener('compositionstart', this.boundDelegator);
        this.root.removeEventListener('compositionupdate', this.boundDelegator);
        this.root.removeEventListener('compositionend', this.boundDelegator);
        this.root.removeEventListener('mousedown', this.boundDelegator);
        this.root.removeEventListener('paste', this.boundDelegator);

        window.removeEventListener('mouseup', this.boundDelegator);

        this.disconnectMutationObserver();
    }

    public delegator(e: Event): void {
        const eventType = e.type;
        const fn = this['handle' + Util.pascalCase(eventType)];

        if (typeof fn !== 'function') {
            throw new Error(`[EventManager] No handler found for event "${eventType}"`);
        }

        fn.call(this, e);
    }

    public connectMutationObserver() {
        this.observer.observe(this.root, {
            childList: true,
            characterData: true,
            characterDataOldValue: true,
            subtree: true
        });
    }

    public disconnectMutationObserver() {
        this.observer.disconnect();
    }

    public handleKeypress(e: KeyboardEvent): void {
        e.preventDefault();

        this.isActioning = true;

        this.tome.applyAction({type: ActionType.INSERT, content: e.key});

        setTimeout(() => (this.isActioning = false), ACTION_DELAY);
    }

    public handleMouseup(): void {
        if (this.tome.dom.root !== document.activeElement) return;

        this.tome.applyAction({type: ActionType.SET_SELECTION});
    }

    public handleMousedown(): void {
        this.tome.applyAction({type: ActionType.SET_SELECTION});
    }

    public handlePaste(e: ClipboardEvent): void {
        const {clipboardData} = e;
        const text = clipboardData.getData('text/plain');
        const html = clipboardData.getData('text/html');

        this.tome.applyAction({type: ActionType.PASTE, data: {text, html}});

        e.preventDefault();
    }

    public handleTextInput(e: IInputEvent): void {
        e.preventDefault();

        this.isActioning = true;

        this.tome.applyAction({type: ActionType.INSERT, content: e.data});

        setTimeout(() => (this.isActioning = false), ACTION_DELAY);
    }

    public handleCompositionstart(): void {
        this.isComposing = true;
    }

    public handleCompositionupdate(): void {
        this.isComposing = true;
    }

    public handleCompositionend(): void {
        this.isComposing = false;
    }

    public handleMutation(mutations) {
        if (this.isActioning) return;

        let action: IAction;

        mutations.forEach(mutation => {
            if (mutation.type === MutationType.CHARACTER_DATA) {
                action = IMEParser.handleCharacterMutation(mutation, this.tome, this.isComposing);
            }
        });

        this.isActioning = true;

        this.tome.applyAction(action);

        setTimeout(() => (this.isActioning = false), SELECTION_DELAY);
    }

    public handleKeydown(e: KeyboardEvent): void {
        const key = e.key.toLowerCase();

        if (key === Keypress.UNIDENTIFIED) {
            return;
        }

        let action: IAction = null;

        if (e.metaKey) {
            switch (key) {
                case Keypress.A:
                    action = {type: ActionType.SET_SELECTION};

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
                    action = {type: ActionType.CUT, tag: MarkupTag.EM};

                    break;
                case Keypress.C:
                    action = {type: ActionType.COPY, tag: MarkupTag.EM};

                    break;
                case Keypress.S:
                    action = {type: ActionType.SAVE, tag: MarkupTag.EM};

                    e.preventDefault();

                    break;
                case Keypress.Z:
                    e.preventDefault();

                    return e.shiftKey ? this.tome.redo() : this.tome.undo();
                case Keypress.H:
                    action = {type: ActionType.CHANGE_BLOCK_TYPE, tag: MarkupTag.H1};

                    e.preventDefault();

                    break;
                case Keypress.K: {
                    const callback = this.tome.config.callbacks.onAddAnchor;

                    e.preventDefault();

                    if (typeof callback !== 'function') {
                        throw new TypeError('[Tome] No `onAddAnchor` callback function provided');
                    }

                    const handlerAccept = (data: IAnchorData) => {
                        action = {type: ActionType.TOGGLE_INLINE, tag: MarkupTag.A, data};

                        this.tome.applyAction(action);
                    };

                    callback(handlerAccept);

                    return;
                }
            }
        }

        switch (key) {
            case Keypress.ENTER:
                action = {type: e.shiftKey ? ActionType.SHIFT_RETURN : ActionType.RETURN};

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
                action = {type: ActionType.SET_SELECTION};

                break;
        }

        if (!action || action.type === ActionType.NONE) return;

        this.isActioning = true;

        setTimeout(() => this.tome.applyAction(action), SELECTION_DELAY);

        setTimeout(() => (this.isActioning = false), ACTION_DELAY);
    }
}

export default EventManager;
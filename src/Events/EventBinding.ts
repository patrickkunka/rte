import IEventBinding from './Interfaces/IEventBinding';
import IEventHandler from './Interfaces/IEventHandler';

class EventBinding implements IEventBinding {
    public type: string = '';
    public target: HTMLElement = null;
    public debounce: number = 0;
    public handler: IEventHandler = null;

    constructor(eventBindingRaw: IEventBinding|string) {
        if (typeof eventBindingRaw === 'string') {
            this.type = eventBindingRaw;
        } else {
            Object.assign(this, eventBindingRaw);
        }
        Object.seal(this);
    }

    public unbind() {
        this.target.removeEventListener(this.type, this.handler);
    }
}

export default EventBinding;
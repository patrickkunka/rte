import SelectionDirection from '../constants/SelectionDirection';
import ISelection         from '../interfaces/ISelection';

class EditorRange implements ISelection {
    from: number;
    to:   number;
    direction: SelectionDirection;

    constructor(from: number=-1, to:number=-1, direction:SelectionDirection=SelectionDirection.LTR) {
        this.from       = from;
        this.to         = to;
        this.direction  = direction;
    }

    get isCollapsed() {
        return this.from === this.to;
    }

    get isLtr() {
        return this.direction === SelectionDirection.LTR;
    }

    get isRtl() {
        return this.direction === SelectionDirection.RTL;
    }

    get anchor() {
        if (this.isLtr) {
            return this.from;
        }

        return this.to;
    }

    get extent() {
        if (this.isLtr) {
            return this.to;
        }

        return this.from;
    }
}

export default EditorRange;
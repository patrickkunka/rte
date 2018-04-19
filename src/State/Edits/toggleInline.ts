import Action             from '../Action';
import MarkupTag          from '../Constants/MarkupTag';
import MarkupsMap         from '../MarkupsMap';
import State              from '../State';
import setActiveMarkups   from '../Util/setActiveMarkups';
import addInlineMarkup    from './addInlineMarkup';
import removeInlineMarkup from './removeInlineMarkup';

function toggleInline(prevState: State, action: Action) {
    const allowedMarkups: string[] = Object.keys(MarkupTag).map(key => MarkupTag[key]);

    let nextState: State;

    if (allowedMarkups.indexOf(action.tag) < 0) {
        throw new RangeError(`[Tome] Unknown markup tag "${action.tag}"`);
    }

    if (action.range.isUnselected) return prevState;

    if (action.range.isCollapsed) {
        // Collapsed selection, create inline markup override

        nextState = Object.assign(new State(), prevState);

        nextState.activeInlineMarkups = Object.assign(new MarkupsMap(), prevState.activeInlineMarkups);

        const {overrides} = nextState.activeInlineMarkups;
        const overrideIndex = overrides.indexOf(action.tag);

        if (overrideIndex < 0) {
            overrides.push(action.tag);
        } else {
            overrides.splice(overrideIndex, 1);
        }

        return nextState;
    }

    if (prevState.isTagActive(action.tag)) {
        nextState = removeInlineMarkup(prevState, action.tag, action.range.from, action.range.to);
    } else {
        nextState = addInlineMarkup(
            prevState,
            action.tag,
            action.range.from,
            action.range.to,
            action.data
        );
    }

    setActiveMarkups(nextState, action.range);

    return nextState;
}

export default toggleInline;
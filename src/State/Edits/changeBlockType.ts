import merge from 'helpful-merge';

import MarkupTag     from '../Constants/MarkupTag';
import Markup        from '../Markup';
import State         from '../State';
import sanitizeLists from '../Util/sanitizeLists';

/**
 * Changes the currently active block markup to the provided tag.
 */

function changeBlockType(prevState: State, tag: MarkupTag): State {
    const nextState = merge(new State(), prevState, true);
    const isChangingToList = [MarkupTag.OL, MarkupTag.UL].includes(tag);

    let newTag = tag;
    let wrappingList = null;
    let firstListItemIndex = -1;
    let isListAffected = false;

    if (isChangingToList) {
        // If converting one or more blocks to a list, a wrapping <ol>
        // or <ul> is applied, and each inner block is converted to a <li>

        const {envelopedBlockMarkups} = prevState;
        const firstEnvelopedStart = envelopedBlockMarkups[0].start;
        const lastEnvelopedEnd = envelopedBlockMarkups[envelopedBlockMarkups.length - 1].end;

        wrappingList = new Markup([tag, firstEnvelopedStart, lastEnvelopedEnd]);

        newTag = MarkupTag.LI;
    }

    // TODO: add configuration option to strip inline markups from non-
    // paragraph blocks

    nextState.markups = prevState.markups.map((prevMarkup, i) => {
        const nextMarkup = new Markup(prevMarkup.toArray());

        if (isChangingToList && prevState.activeListMarkup === prevMarkup) {
            // Ensure list tag tracks new block type

            nextMarkup[0] = tag;
        }

        if (prevState.envelopedBlockMarkups.includes(prevMarkup)) {
            if (prevMarkup.isListItem) {
                isListAffected = true;
            }

            if (wrappingList && !prevMarkup.isListItem && firstListItemIndex < 0) {
                firstListItemIndex = i;
            }

            // If markup is enveloped, change its tag

            nextMarkup[0] = newTag;
        }

        return nextMarkup;
    });

    if (firstListItemIndex > -1) {
        nextState.markups.splice(firstListItemIndex, 0, wrappingList);
    }

    if (isListAffected) {
        sanitizeLists(nextState.markups);
    }

    return nextState;
}

export default changeBlockType;
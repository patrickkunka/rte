import HtmlEntity             from '../Constants/HtmlEntity';
import MarkupTag              from '../Constants/MarkupTag';
import MarkupType             from '../Constants/MarkupType';
import State                  from '../State';
import TomeSelection          from '../TomeSelection';
import getMarkupOfTypeAtIndex from '../Util/getMarkupOfTypeAtIndex';
import sanitizeLists          from '../Util/sanitizeLists';
import changeBlockType        from './changeBlockType';
import insert                 from './insert';

function insertBlockBreak(prevState: State, range: TomeSelection): State {
    if (range.isCollapsed) {
        const listItemAtIndex = getMarkupOfTypeAtIndex(
            prevState.markups,
            MarkupType.LIST_ITEM,
            range.from
        );

        if (listItemAtIndex && listItemAtIndex.isEmpty) {
            // If the current markup is an empty list item, convert it to a <p>

            const nextState = changeBlockType(prevState, MarkupTag.P);

            sanitizeLists(nextState.markups);

            return nextState;
        }
    }

    return insert(prevState, range, HtmlEntity.BLOCK_BREAK);
}

export default insertBlockBreak;
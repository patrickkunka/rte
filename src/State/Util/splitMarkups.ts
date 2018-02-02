import HtmlEntity from '../Constants/HtmlEntity';
import MarkupTag  from '../Constants/MarkupTag';
import Markup     from '../Markup';

/**
 * Splits a markup at the provided index, creating a new markup
 * of the same type starting two characters later (\n\n). Assumes the
 * addition of a block break.
 */

function splitMarkups(markups: Markup[], splitIndex: number): Markup[] {
    let listToExtend = null;

    for (let i = 0; i < markups.length; i++) {
        const markup = markups[i];
        const originalMarkupEnd = markup.end;

        let newMarkup = null;

        if (markup.start <= splitIndex && markup.end > splitIndex) {
            // Iterate through any markup that envelops the split index

            const newStartIndex = splitIndex + HtmlEntity.BLOCK_BREAK.length;
            const newTag = markup.isBlock && markup.end === newStartIndex ?
                MarkupTag.P : markup.tag;

            let j = i + 1;
            let insertIndex = -1;

            // Contract markup

            markup[2] = splitIndex;

            if (markup.isInline && markup[1] === markup[2]) {
                // Markup has contracted into non-existence

                markups.splice(i, 1);

                i--;

                continue;
            } else if ([MarkupTag.UL, MarkupTag.OL].indexOf(markup.tag) > -1) {
                // Markup is a wrapping list element and should not be split
                // but extended

                listToExtend = markup;

                continue;
            }

            newMarkup = new Markup([newTag, newStartIndex, originalMarkupEnd]);

            // Find appropriate insertion index

            for (; j < markups.length; j++) {
                const siblingMarkup = markups[j];

                if (siblingMarkup.start === newStartIndex) {
                    insertIndex = newMarkup.isBlock ? j : j + 1;

                    break;
                } else if (siblingMarkup.start > newStartIndex) {
                    insertIndex = j;

                    break;
                }
            }

            if (insertIndex < 0) {
                // If no insert index found, insert at end

                insertIndex = j;
            }

            markups.splice(insertIndex, 0, newMarkup);

            if (newMarkup.tag === MarkupTag.LI && listToExtend) {
                listToExtend[2] = newMarkup.end;
            }
        }
    }

    return markups;
}

export default splitMarkups;
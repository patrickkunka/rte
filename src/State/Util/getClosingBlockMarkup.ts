import Markup from '../Markup';

/**
 * Returns the closing block markup after the markup at the
 * provided index.
 */

function getClosingBlockMarkup(markups: Markup[], markupIndex: number, toIndex: number): Markup {
    for (let i = markupIndex + 1, markup; (markup = markups[i]); i++) {
        if (!(markup instanceof Markup)) {
            markup = new Markup(markup);
        }

        if (markup.isBlock && markup.start <= toIndex && markup.end >= toIndex) {
            return markup;
        }
    }

    return null;
}

export default getClosingBlockMarkup;
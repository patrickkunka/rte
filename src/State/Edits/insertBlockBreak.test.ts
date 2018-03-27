import * as chai from 'chai';

import MarkupTag             from '../Constants/MarkupTag';
import Markup                from '../Markup';
import State                 from '../State';
import TomeSelection         from '../TomeSelection';
import insertBlockBreak      from './insertBlockBreak';

const assert = chai.assert;

describe('insertBlockBreak()', () => {
    it('should insert a new empty block and select the first character of the block', () => {
        const prevState = Object.assign(new State(), {
            text: 'Line one.',
            markups: [
                new Markup([MarkupTag.P, 0, 9])
            ]
        });

        const nextState = insertBlockBreak(prevState, new TomeSelection(9, 9));

        assert.equal(nextState.text, 'Line one.\n\n');
        assert.equal(nextState.selection.from, 11);
        assert.equal(nextState.selection.to, 11);
    });

    it('should convert the last empty list item of a list into paragraph if a block return is inserted there', () => {
        const emptyListItem = new Markup([MarkupTag.LI, 42, 42]);

        const prevState = Object.assign(new State(), {
            text: 'List item 1.\n\nList item 2.\n\nList item 3.\n\n',
            markups: [
                new Markup([MarkupTag.UL, 0, 42]),
                new Markup([MarkupTag.LI, 0, 12]),
                new Markup([MarkupTag.LI, 14, 26]),
                new Markup([MarkupTag.LI, 28, 40]),
                emptyListItem
            ],
            envelopedBlockMarkups: [
                emptyListItem
            ],
            activeBlockMarkup: emptyListItem
        });

        const nextState = insertBlockBreak(prevState, new TomeSelection(42, 42));

        const {markups} = nextState;

        assert.equal(markups.length, 5);

        const wrappingList = markups[0];
        const newParagraph = markups[4];

        assert.equal(wrappingList.tag, MarkupTag.UL);
        assert.equal(wrappingList.start, 0);
        assert.equal(wrappingList.end, 40);

        assert.equal(newParagraph.tag, MarkupTag.P);
        assert.equal(newParagraph.start, 42);
        assert.equal(newParagraph.end, 42);
    });
});
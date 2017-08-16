/* eslint-disable no-magic-numbers */

import chai         from 'chai';
import deepEqual    from 'chai-shallow-deep-equal';
import Editor       from './Editor';

chai.use(deepEqual);

const assert = chai.assert;

describe('Editor', () => {
    it('should insert a single character within a markup', () => {
        const state = {
            text: 'Lorem ipsum',
            markups: [
                ['p', 0, 11]
            ]
        };

        const newState = Editor.insert(state, {from: 5, to: 5}, 's');

        assert.equal(newState.text, 'Lorems ipsum');
        assert.equal(newState.markups[0][2], 12);
    });

    it('should insert multiple characters within a markup', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12]
            ]
        };

        const newState = Editor.insert(state, {from: 11, to: 11}, ' dolor');

        assert.equal(newState.text, 'Lorem ipsum dolor.');
        assert.equal(newState.markups[0][2], 18);
    });

    it('should extend an inline markup if characters are inserted at its end', () => {
        const state = {
            text: 'Lorem ipsum dolor sit amet.',
            markups: [
                ['p', 0, 27],
                ['em', 6, 17]
            ]
        };

        const newState = Editor.insert(state, {from: 17, to: 17}, 's');

        assert.equal(newState.text, 'Lorem ipsum dolors sit amet.');
        assert.equal(newState.markups[0][2], 28);
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 18);
    });

    it('should extend a block markup if characters are inserted at its end', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12]
            ]
        };

        const newState = Editor.insert(state, {from: 12, to: 12}, ' Sit');

        assert.equal(newState.text, 'Lorem ipsum. Sit');
        assert.equal(newState.markups[0][2], 16);
    });

    it('should extend a block markup if characters are inserted at its start', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12]
            ]
        };

        const newState = Editor.insert(state, {from: 0, to: 0}, 'Foo ');

        assert.equal(newState.text, 'Foo Lorem ipsum.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 16);
    });

    it('should shunt an inline markup at the start if characters are inserted at its start', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12],
                ['strong', 0, 5]
            ]
        };

        const newState = Editor.insert(state, {from: 0, to: 0}, 'Foo ');

        assert.equal(newState.text, 'Foo Lorem ipsum.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 16);
        assert.equal(newState.markups[1][1], 4);
        assert.equal(newState.markups[1][2], 9);
    });

    it('should shunt an inline markup if characters are replaced at its start', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12],
                ['strong', 6, 11]
            ]
        };

        const newState = Editor.insert(state, {from: 3, to: 6}, 'f');

        assert.equal(newState.text, 'Lorfipsum.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 10);
        assert.equal(newState.markups[1][1], 4);
        assert.equal(newState.markups[1][2], 9);
    });

    it('should increment the position of subsequent markups as are characters are inserted', () => {
        const state = {
            text: 'Lorem ipsum. Sit amet.',
            markups: [
                ['p', 0, 12],
                ['p', 13, 22]
            ]
        };

        const newState = Editor.insert(state, {from: 11, to: 11}, ' dolor');

        assert.equal(newState.text, 'Lorem ipsum dolor. Sit amet.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 18);
        assert.equal(newState.markups[1][1], 19);
        assert.equal(newState.markups[1][2], 28);
    });

    it('should maintain markups that exist before the position that characters are inserted', () => {
        const state = {
            text: 'Lorem ipsum. Sit amet.',
            markups: [
                ['p', 0, 12],
                ['p', 13, 23]
            ]
        };

        const newState = Editor.insert(state, {from: 21, to: 21}, ', consectetur');

        assert.equal(newState.text, 'Lorem ipsum. Sit amet, consectetur.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 12);
        assert.equal(newState.markups[1][1], 13);
    });

    it('should replace a range of characters with inserted characters', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12]
            ]
        };

        const newState = Editor.insert(state, {from: 6, to: 11}, 'dolor');

        assert.equal(newState.text, 'Lorem dolor.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 12);
    });

    it('should completely remove any markups which are enveloped by the range', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12],
                ['strong', 6, 11]
            ]
        };

        const newState = Editor.insert(state, {from: 5, to: 12}, 'dolor.');

        assert.equal(newState.text, 'Loremdolor.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 11);
        assert.isNotOk(newState.markups[1]);
    });

    it('should completely remove inline any markups which are equal to the range', () => {
        const state = {
            text: 'Lorem ipsum dolor.',
            markups: [
                ['p', 0, 18],
                ['strong', 6, 11]
            ]
        };

        const newState = Editor.insert(state, {from: 5, to: 11}, '');

        assert.equal(newState.text, 'Lorem dolor.');
        assert.equal(newState.markups.length, 1);
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 12);
    });

    it('should preserve block markups which are equal to the range', () => {
        const state = {
            text: 'Lorem ipsum dolor.',
            markups: [
                ['p', 0, 18]
            ]
        };

        const newState = Editor.insert(state, {from: 0, to: 18}, '');

        assert.equal(newState.text, '');
        assert.equal(newState.markups.length, 1);
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 0);
    });

    it('should maintain inline markups which are partially enveloped by the range from the start', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12],
                ['strong', 6, 11]
            ]
        };

        const newState = Editor.insert(state, {from: 3, to: 8}, 'foo');

        assert.equal(newState.text, 'Lorfoosum.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 10);
        assert.isOk(newState.markups[1]);
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 9);
    });

    it('should expand inline markups which are partially enveloped by the range from the end', () => {
        const state = {
            text: 'Lorem ipsum.',
            markups: [
                ['p', 0, 12],
                ['strong', 0, 5]
            ]
        };

        const newState = Editor.insert(state, {from: 3, to: 8}, 'foo');

        assert.equal(newState.text, 'Lorfoosum.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 10);
        assert.isOk(newState.markups[1]);
        assert.equal(newState.markups[1][1], 0);
        assert.equal(newState.markups[1][2], 6);
        assert.isNotOk(newState.markups[2]);
    });

    it('should expand inline markups which are partially enveloped by the range from the end', () => {
        const state = {
            text: 'Lorem ipsum dolor.',
            markups: [
                ['p', 0, 18],
                ['strong', 6, 11]
            ]
        };

        const newState = Editor.insert(state, {from: 8, to: 14}, 'foo');

        assert.equal(newState.text, 'Lorem ipfoolor.');
        assert.equal(newState.markups[0][1], 0);
        assert.equal(newState.markups[0][2], 15);
        assert.isOk(newState.markups[1]);
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 11);
        assert.isNotOk(newState.markups[2]);
    });

    it('should combine two block markups which are each partially enveloped', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 18],
                ['p', 19, 28]
            ]
        };

        const newState = Editor.insert(state, {from: 11, to: 22}, '');

        assert.equal(newState.text, 'Lorem ipsum amet.');
        assert.equal(newState.markups[0][2], 17);
        assert.isNotOk(newState.markups[1]);
    });

    it('should combine two block markups containing inline markups which are each partially enveloped', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 18],
                ['em', 6, 11],
                ['p', 19, 28]
            ]
        };

        const newState = Editor.insert(state, {from: 11, to: 22}, '');

        assert.equal(newState.text, 'Lorem ipsum amet.');
        assert.equal(newState.markups[0][2], 17);
        assert.isOk(newState.markups[1]);
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 11);
        assert.isNotOk(newState.markups[2]);
    });

    it('should split a block markup into two block markups at an arbitrary point', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 28]
            ]
        };

        const newState = Editor.insert(state, {from: 3, to: 3}, '\n');

        assert.equal(newState.text, 'Lor\nem ipsum dolor. Sit amet.');
        assert.equal(newState.markups[0][2], 3);
        assert.isOk(newState.markups[1]);
        assert.equal(newState.markups[1][1], 4);
        assert.equal(newState.markups[1][2], 29);
        assert.equal(newState.selection.from, 4);
    });

    it('should split a block markup into two block markups at a whitespace, removing whitespace before the break', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 28]
            ]
        };

        const newState = Editor.insert(state, {from: 19, to: 19}, '\n');

        assert.equal(newState.text, 'Lorem ipsum dolor.\nSit amet.');
        assert.equal(newState.text.length, 28);
        assert.equal(newState.markups[0][2], 18);
        assert.isOk(newState.markups[1]);
        assert.equal(newState.markups[1][1], 19);
        assert.equal(newState.markups[1][2], 28);
        assert.equal(newState.selection.from, 19);
    });

    it('should split a block markup into two block markups at a whitespace, removing whitespace after the break', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 28]
            ]
        };

        const newState = Editor.insert(state, {from: 18, to: 18}, '\n');

        assert.equal(newState.text, 'Lorem ipsum dolor.\nSit amet.');
        assert.equal(newState.text.length, 28);
        assert.equal(newState.markups[0][2], 18);
        assert.isOk(newState.markups[1]);
        assert.equal(newState.markups[1][1], 19);
        assert.equal(newState.markups[1][2], 28);
        assert.equal(newState.selection.from, 19);
    });

    it('should split a subsequent block markup into two block markups at an arbitrary point', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.\nTest Heading',
            markups: [
                ['p', 0, 28],
                ['h2', 29, 41]
            ]
        };

        const newState = Editor.insert(state, {from: 34, to: 34}, '\n');

        assert.equal(newState.text, 'Lorem ipsum dolor. Sit amet.\nTest\nHeading');
        assert.equal(newState.markups.length, 3);
        assert.equal(newState.markups[2][1], 34);
        assert.equal(newState.markups[2][2], 41);
        assert.equal(newState.selection.from, 34);
    });

    // DOESN'T WORK

    // it('should join two block markups into one block markups on deletion of line break', () => {
    //     const state = {
    //         text: 'Lorem ipsum dolor.\nSit amet.',
    //         markups: [
    //             ['p', 0, 18],
    //             ['p', 19, 28]
    //         ]
    //     };

    //     const newState = Editor.insert(state, {from: 18, to: 19}, '');

    //     assert.equal(newState.text, 'Lorem ipsum dolor.Sit amet.');
    //     assert.equal(newState.markups[0][2], 27);
    //     assert.isNotOk(newState.markups[1]);
    // });

    it('should add an inline markup within a selection', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 28]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.addInlineMarkup(state, 'strong', 6, 11);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 2);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 11);
    });

    it('should add an inline markup at the start of a selection', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 28]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.addInlineMarkup(state, 'strong', 0, 5);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 2);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[1][1], 0);
        assert.equal(newState.markups[1][2], 5);
    });

    it('should add an inline markup at the end of a selection', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 28]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.addInlineMarkup(state, 'strong', 23, 28);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 2);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[1][1], 23);
        assert.equal(newState.markups[1][2], 28);
    });

    it('should add an inline markup at the start of second block element', () => {
        const state = {
            text: 'Lorem ipsum dolor.\nSit amet.',
            markups: [
                ['p', 0, 18],
                ['p', 19, 50]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.addInlineMarkup(state, 'strong', 19, 22);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 3);
        assert.equal(newState.markups[2][0], 'strong');
        assert.equal(newState.markups[2][1], 19);
        assert.equal(newState.markups[2][2], 22);
    });

    it('should merge like inline markups when adjacent', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 50],
                ['strong', 6, 11]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.addInlineMarkup(state, 'strong', 11, 17);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 2);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 17);
    });

    it('should insert an inline markup within another inline markup', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 50],
                ['strong', 6, 17]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.addInlineMarkup(state, 'em', 8, 11);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 3);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[2][0], 'em');
        assert.equal(newState.markups[2][1], 8);
        assert.equal(newState.markups[2][2], 11);
    });

    it('should remove an inline markup', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 50],
                ['strong', 6, 17]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.removeInlineMarkup(state, 'strong', 6, 17);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 1);
    });

    it('should remove the start of inline markup', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 50],
                ['strong', 6, 17]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.removeInlineMarkup(state, 'strong', 6, 12);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 2);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[1][1], 12);
        assert.equal(newState.markups[1][2], 17);
    });

    it('should remove the end of inline markup', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 50],
                ['strong', 6, 17]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.removeInlineMarkup(state, 'strong', 11, 17);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 2);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 11);
    });

    it('should remove an internal section of an inline markup', () => {
        const state = {
            text: 'Lorem ipsum dolor. Sit amet.',
            markups: [
                ['p', 0, 50],
                ['strong', 6, 17]
            ],
            envelopedBlockMarkups: []
        };

        const newState = Editor.removeInlineMarkup(state, 'strong', 12, 14);

        assert.equal(newState.text, state.text);
        assert.equal(newState.markups.length, 3);
        assert.equal(newState.markups[1][0], 'strong');
        assert.equal(newState.markups[1][1], 6);
        assert.equal(newState.markups[1][2], 12);
        assert.equal(newState.markups[2][1], 14);
        assert.equal(newState.markups[2][2], 17);
    });
});
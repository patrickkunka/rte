import * as chai from 'chai';

const {assert} = chai;

import IValue          from '../State/Interfaces/IValue';
import RenderMode      from './Constants/RenderMode';
import IRendererParams from './Interfaces/IRendererParams';
import Renderer        from './Renderer';
import TomeNode        from './TomeNode';

interface ITestContext {
    renderer: Renderer;
    mockRoot: TomeNode;
    mockValue: IValue;
    mockValueWithCustomBlock: IValue;
}

const createNode = data => {
    const node = Object.assign(new TomeNode(), data);

    node.childNodes.forEach(childNode => childNode.parent = node);

    return node;
};

describe('Renderer', function() {
    // @ts-ignore
    const self: ITestContext = this;

    beforeEach(() => {
        self.renderer = new Renderer();

        self.mockRoot = createNode({
            childNodes: [
                createNode({
                    tag: 'p',
                    start: 0,
                    end: 3,
                    childNodes: [
                        createNode({
                            tag: '#text',
                            text: 'f',
                            start: 0,
                            end: 1
                        }),
                        createNode({
                            tag: 'em',
                            start: 1,
                            end: 3,
                            childNodes: [
                                createNode({
                                    tag: '#text',
                                    text: 'oo',
                                    start: 1,
                                    end: 3
                                })
                            ]
                        })
                    ]
                })
            ]
        });

        self.mockValue = {
            text: 'foo',
            markups: [
                ['p', 0, 3],
                ['em', 1, 3]
            ]
        };

        self.mockValueWithCustomBlock = {
            text: 'foo\n\n',
            markups: [
                ['p', 0, 3],
                ['em', 1, 3],
                ['CustomBlock', 5, 5, {foo: 'bar'}]
            ]
        };
    });

    it('accepts a consumer-provided "custom block" hash object', () => {
        const renderer = new Renderer({foo: () => ''});

        assert.typeOf(renderer.customBlocks.foo, 'function');
    });

    describe('#renderValueToHtml()', () => {
        it('renders a give `IValue` to an HTML string', () => {
            const html = self.renderer.renderValueToHtml(self.mockValue);

            assert.equal(html, '<p>f<em>oo</em></p>');
        });
    });

    describe('#renderTreeToHtml()', () => {
        it('renders a given `TomeNode` tree to an HTML string', () => {
            const html = self.renderer.renderTreeToHtml(self.mockRoot);

            assert.equal(html, '<p>f<em>oo</em></p>');
        });
    });

    describe('#renderValueToModules()', () => {
        it('renders a give `IValue` to a list of "modules"', () => {
            const modules = self.renderer.renderValueToModules(self.mockValue);

            assert.deepEqual(modules, [
                {
                    name: 'p',
                    data: {
                        content: 'f<em>oo</em>'
                    }
                }
            ]);
        });

        it('renders a given `IValue` including custom blocks to a list of "modules"', () => {
            const modules = self.renderer.renderValueToModules(self.mockValueWithCustomBlock);

            assert.deepEqual(modules, [
                {
                    name: 'p',
                    data: {
                        content: 'f<em>oo</em>'
                    }
                },
                {
                    name: 'CustomBlock',
                    data: {
                        foo: 'bar'
                    }
                }
            ]);
        });
    });

    describe('#renderTreeToModules()', () => {
        it('renders a give `TomeNode` tree to a list of "modules"', () => {
            const modules = self.renderer.renderTreeToModules(self.mockRoot);

            assert.deepEqual(modules, [
                {
                    name: 'p',
                    data: {
                        content: 'f<em>oo</em>'
                    }
                }
            ]);
        });

        it('will not create a module for a trailing empty `<p>` tag', () => {
            const root: TomeNode = createNode({
                childNodes: [
                    createNode({
                        tag: 'p',
                        start: 0,
                        end: 5
                    }),
                    createNode({
                        tag: 'p',
                        start: 7,
                        end: 7
                    })
                ]
            });

            const modules = self.renderer.renderTreeToModules(root);

            assert.equal(modules.length, 1);
        });

        it('will create a module for an `<p>` tag if not the last block', () => {
            const root: TomeNode = createNode({
                childNodes: [
                    createNode({
                        tag: 'p',
                        start: 0,
                        end: 5
                    }),
                    createNode({
                        tag: 'p',
                        start: 7,
                        end: 7
                    }),
                    createNode({
                        tag: 'p',
                        start: 9,
                        end: 11
                    })
                ]
            });

            const modules = self.renderer.renderTreeToModules(root);

            assert.equal(modules.length, 3);
        });
    });

    describe('#renderNodeToHtml()', () => {
        it('renders a custom block', () => {
            const renderer = new Renderer({
                foo: (_, data) => `<div>${data.content}</div>`
            });

            const root: TomeNode = createNode({
                childNodes: [
                    createNode({
                        tag: 'foo',
                        data: {
                            content: 'bar'
                        }
                    })
                ]
            });

            const html = renderer.renderNodeToHtml(
                {mode: RenderMode.CONSUMER},
                root.childNodes[0],
                root
            );

            assert.equal(html, '<div>bar</div>');
        });

        it('will not render tailing empty `<p>` tags in consumer mode', () => {
            const root: TomeNode = createNode({
                childNodes: [
                    createNode({
                        tag: 'p',
                        start: 0,
                        end: 0
                    })
                ]
            });

            const html = self.renderer.renderNodeToHtml(
                {mode: RenderMode.CONSUMER},
                root.childNodes[0],
                root
            );

            assert.equal(html, '');
        });

        it('will render all provided attributes when required', () => {
            const root: TomeNode = createNode({
                childNodes: [
                    createNode({
                        tag: 'p',
                        start: 0,
                        end: 3,
                        childNodes: [
                            createNode({
                                tag: 'a',
                                start: 0,
                                end: 3,
                                data: {
                                    href: 'https://www.google.com',
                                    target: '_blank',
                                    title: 'foo'
                                },
                                childNodes: [
                                    createNode({
                                        tag: '#text',
                                        start: 0,
                                        end: 3,
                                        text: 'foo'
                                    })
                                ]
                            })
                        ]
                    })
                ]
            });

            const html = self.renderer.renderNodeToHtml(
                {mode: RenderMode.CONSUMER},
                root.childNodes[0],
                root
            );

            assert.equal(
                html,
                '<p><a href="https://www.google.com" target="_blank" title="foo">foo</a></p>'
            );
        });
    });

    describe('#renderNodeContent()', () => {
        it('renders the contents of text leaf nodes', () => {
            const root: TomeNode = createNode({
                tag: 'p',
                start: 0,
                end: 3,
                childNodes: [
                    createNode({
                        tag: '#text',
                        start: 0,
                        end: 3,
                        text: 'foo'
                    })
                ]
            });

            const content = self.renderer.renderNodeContent(
                {mode: RenderMode.CONSUMER},
                root.childNodes[0],
                root
            );

            assert.equal(content, 'foo');
        });

        it('inserts <br> tags into empty text nodes when in editor mode', () => {
            const root: TomeNode = createNode({
                tag: 'p',
                start: 0,
                end: 0,
                childNodes: [
                    createNode({
                        tag: '#text',
                        start: 0,
                        end: 0,
                        text: ''
                    })
                ]
            });

            const content = self.renderer.renderNodeContent(
                {mode: RenderMode.EDITOR},
                root.childNodes[0],
                root
            );

            assert.equal(content, '<br>');
        });

        it('renders nothing for an empty text node in consumer mode', () => {
            const root: TomeNode = createNode({
                tag: 'p',
                start: 0,
                end: 0,
                childNodes: [
                    createNode({
                        tag: '#text',
                        start: 0,
                        end: 0,
                        text: ''
                    })
                ]
            });

            const content = self.renderer.renderNodeContent(
                {mode: RenderMode.CONSUMER},
                root.childNodes[0],
                root
            );

            assert.equal(content, '');
        });

        it('inserts <br> tags into text nodes with a trailing space when in editor mode', () => {
            const root: TomeNode = createNode({
                tag: 'p',
                start: 0,
                end: 4,
                childNodes: [
                    createNode({
                        tag: '#text',
                        start: 0,
                        end: 4,
                        text: 'foo '
                    })
                ]
            });

            const content = self.renderer.renderNodeContent(
                {mode: RenderMode.EDITOR},
                root.childNodes[0],
                root
            );

            assert.equal(content, 'foo <br>');
        });

        it('renders block break nodes as a single line break', () => {
            const root: TomeNode = createNode({
                start: 0,
                end: 2,
                childNodes: [
                    createNode({
                        tag: '#text',
                        start: 0,
                        end: 2,
                        text: '\n\n'
                    })
                ]
            });

            const content = self.renderer.renderNodeContent(
                {mode: RenderMode.EDITOR},
                root.childNodes[0],
                root
            );

            assert.equal(content, '\n');
        });

        it('inserts renders consecutive spaces as visible whitespace', () => {
            const root: TomeNode = createNode({
                tag: 'p',
                start: 0,
                end: 10,
                childNodes: [
                    createNode({
                        tag: '#text',
                        start: 0,
                        end: 3,
                        text: '   '
                    })
                ]
            });

            const content = self.renderer.renderNodeContent(
                {mode: RenderMode.CONSUMER},
                root.childNodes[0],
                root
            );

            assert.equal(content, ` ${String.fromCharCode(0xa0)} `);
        });

        it('render a leading space as a non-breaking space', () => {
            const root: TomeNode = createNode({
                tag: 'p',
                start: 0,
                end: 10,
                childNodes: [
                    createNode({
                        tag: '#text',
                        start: 0,
                        end: 4,
                        text: ' foo'
                    })
                ]
            });

            const content = self.renderer.renderNodeContent(
                {mode: RenderMode.CONSUMER},
                root.childNodes[0],
                root
            );

            assert.equal(content, `${String.fromCharCode(0xa0)}foo`);
        });
    });

    describe('#renderCustomBlock()', () => {
        it('pushes an `ICustomBlockInstance` into the provided params array, when in editor mode', () => {
            const params: IRendererParams = {
                customBlockInstances: [],
                mode: RenderMode.EDITOR
            };

            const customBlock = createNode({
                tag: 'foo',
                path: [0, 1, 2],
                data: {
                    bar: 'baz'
                }
            });

            self.renderer.renderCustomBlockToHtml(params, customBlock);

            assert.deepEqual(params.customBlockInstances, [
                {
                    path: customBlock.path,
                    type: customBlock.tag,
                    data: customBlock.data
                }
            ]);
        });

        it('returns an empty `<div>` with a `contenteditable="false" attribute` when in editor mode', () => {
            const params: IRendererParams = {
                customBlockInstances: [],
                mode: RenderMode.EDITOR
            };

            const customBlock = createNode({
                tag: 'foo',
                path: [0, 1, 2],
                data: {
                    bar: 'baz'
                }
            });

            const html = self.renderer.renderCustomBlockToHtml(params, customBlock);

            assert.equal(html, '<div contenteditable="false"></div>');
        });

        it('invokes a consumer-provided render function when in consumer mode', () => {
            const renderer = new Renderer({
                foo: (type, data) => `<div class="${type}">${data.bar}</div>`
            });

            const customBlock = createNode({
                tag: 'foo',
                path: [0, 1, 2],
                data: {
                    bar: 'baz'
                }
            });

            const html = renderer.renderCustomBlockToHtml({
                mode: RenderMode.CONSUMER
            }, customBlock);

            assert.equal(html, '<div class="foo">baz</div>');
        });

        it('throws a `TypeError` when no consumer render function is available', () => {
            const customBlock = createNode({
                tag: 'foo',
                path: [0, 1, 2],
                data: {
                    bar: 'baz'
                }
            });

            assert.throws(() => {
                self.renderer.renderCustomBlockToHtml({
                    mode: RenderMode.CONSUMER
                }, customBlock);
            }, TypeError);
        });
    });
});

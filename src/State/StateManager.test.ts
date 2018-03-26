import 'jsdom-global/register';

import * as chai      from 'chai';
import * as deepEqual from 'chai-shallow-deep-equal';
import * as sinon     from 'sinon';

import ITome                   from '../Tome/Interfaces/ITome';
import MockTome                from '../Tome/Mocks/MockTome';
import ActionType              from './Constants/ActionType';
import HistoryManipulationType from './Constants/HistoryManipulationType';
import MarkupTag               from './Constants/MarkupTag';
import IAction                 from './Interfaces/IAction';
import IValue                  from './Interfaces/IValue';
import State                   from './State';
import StateManager            from './StateManager';
import TomeSelection           from './TomeSelection';

chai.use(deepEqual);

// @ts-ignore
const {DURATION_BLOCK_PUSH, DURATION_BACKUP} = StateManager;
const {assert} = chai;
const {spy, stub} = sinon;

interface ITestContext {
    tome: ITome;
    stateManager: StateManager;
    initialValue: IValue;
    nextValue: IValue;
    nextAction: IAction;
    getSelectionSpy: sinon.SinonSpy;
    mockInit();
    mockPushState(nextState?: State);
    mockUndo();
}

describe.only('StateManager', function() {
    // @ts-ignore
    const self: ITestContext = this;

    self.initialValue = {
        text: 'foo',
        markups: [
            [MarkupTag.P, 0, 3]
        ]
    };

    self.nextValue = {
        text: 'fooo',
        markups: [
            [MarkupTag.P, 0, 4]
        ]
    };

    self.nextAction = {
        type: ActionType.INSERT,
        content: 'o',
        range: {
            from: 3,
            to: 3
        }
    };

    self.mockInit = () => {
        self.stateManager.init(self.initialValue);
    };

    self.mockPushState = (nextState = new State(self.nextValue)) => {
        // @ts-ignore
        self.stateManager.pushStateToHistory(nextState);
    };

    beforeEach(() => {
        const root = document.createElement('div');
        const anchorNode = document.createElement('p');

        root.appendChild(anchorNode);

        self.tome = new MockTome();
        self.stateManager = new StateManager(self.tome);

        self.tome.dom.root = root;

        self.getSelectionSpy = window.getSelection = spy(() => ({
            anchorNode
        }));
    });

    afterEach(() => {
        delete window.getSelection;

        // @ts-ignore
        StateManager.DURATION_BLOCK_PUSH = DURATION_BLOCK_PUSH;
        // @ts-ignore
        StateManager.DURATION_BACKUP = DURATION_BACKUP;
    });

    it('instantiates with no state or history', () => {
        assert.isNull(self.stateManager.state);
        assert.equal(self.stateManager.historyIndex, -1);
    });

    describe('#init()', () => {
        it('loads an initial state into the history', () => {
            self.stateManager.init(self.initialValue);

            assert.instanceOf(self.stateManager.state, State);
            assert.equal(self.stateManager.historyIndex, 0);
        });

        it('renders the tree and positions the caret', () => {
            self.stateManager.init(self.initialValue);

            assert.isTrue((self.tome.tree.render as any).calledWith(true));
            assert.isTrue((self.tome.tree.positionCaret as any).calledWith({
                from: 0, to: 0, direction: 'LTR'
            }));
        });
    });

    describe('#undo()', () => {
        it('removes an item from the history', () => {
            self.mockInit();

            const initialState = self.stateManager.state;
            const nextState = new State(self.nextValue);

            self.mockPushState(nextState);

            assert.equal(self.stateManager.state, nextState);
            assert.equal(self.stateManager.historyIndex, 1);

            self.stateManager.undo();

            assert.equal(self.stateManager.state, initialState);
            assert.equal(self.stateManager.historyIndex, 0);
        });

        it('invokes `raiseIsActioningFlag()`', () => {
            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();

            assert.isTrue((self.tome.eventManager.raiseIsActioningFlag as sinon.SinonSpy).calledOnce);
        });

        it('renders the tree and positions the caret', () => {
            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();

            assert.isTrue((self.tome.tree.render as sinon.SinonSpy).calledTwice);
            assert.isTrue((self.tome.tree.positionCaret as sinon.SinonSpy).calledTwice);
        });

        it('aborts if `historyIndex` is `0`', () => {
            self.mockInit();
            self.mockPushState();

            assert.equal(self.stateManager.historyIndex, 1);

            self.stateManager.undo();

            assert.equal(self.stateManager.historyIndex, 0);

            self.stateManager.undo();

            assert.equal(self.stateManager.historyIndex, 0);
        });

        it('invokes an `onStateChange` callback if provided', () => {
            const callbackSpy = self.tome.config.callbacks.onStateChange = spy();

            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();

            assert.isTrue(callbackSpy.calledOnce);
            assert.isTrue(callbackSpy.calledWith(self.stateManager.state, ActionType.UNDO));
        });

        it('logs to the `console.info()` if `debug` mode enabled', () => {
            self.tome.config.debug.enable = true;

            const consoleInfoStub = stub(console, 'info');

            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();

            assert.isTrue(consoleInfoStub.calledOnce);
            assert.isTrue(consoleInfoStub.calledWith('UNDO (0)'));

            consoleInfoStub.restore();
        });
    });

    describe('#redo()', () => {
        it('reverts to a future state after an undo', () => {
            self.mockInit();

            const nextState = new State(self.nextValue);

            self.mockPushState(nextState);
            self.stateManager.undo();

            assert.notEqual(self.stateManager.state, nextState);
            assert.equal(self.stateManager.historyIndex, 0);

            self.stateManager.redo();

            assert.equal(self.stateManager.state, nextState);
            assert.equal(self.stateManager.historyIndex, 1);
        });

        it('invokes `raiseIsActioningFlag()`', () => {
            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();
            self.stateManager.redo();

            assert.isTrue((self.tome.eventManager.raiseIsActioningFlag as sinon.SinonSpy).calledTwice);
        });

        it('renders the tree and positions the caret', () => {
            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();
            self.stateManager.redo();

            assert.isTrue((self.tome.tree.render as sinon.SinonSpy).calledThrice);
            assert.isTrue((self.tome.tree.positionCaret as sinon.SinonSpy).calledThrice);
        });

        it('aborts if there is no future state(s)', () => {
            self.mockInit();
            self.mockPushState();

            assert.equal(self.stateManager.historyIndex, 1);

            self.stateManager.redo();

            assert.equal(self.stateManager.historyIndex, 1);
        });

        it('invokes an `onStateChange` callback if provided', () => {
            const callbackSpy = self.tome.config.callbacks.onStateChange = spy();

            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();

            assert.isTrue(callbackSpy.calledOnce);
            assert.isTrue(callbackSpy.calledWith(self.stateManager.state, ActionType.UNDO));

            self.stateManager.redo();

            assert.isTrue(callbackSpy.calledTwice);
            assert.isTrue(callbackSpy.calledWith(self.stateManager.state, ActionType.REDO));
        });

        it('logs to the `console.info()` if `debug` mode enabled', () => {
            self.tome.config.debug.enable = true;

            const consoleInfoStub = stub(console, 'info');

            self.mockInit();
            self.mockPushState();
            self.stateManager.undo();

            assert.isTrue(consoleInfoStub.calledOnce);

            self.stateManager.redo();

            assert.isTrue(consoleInfoStub.calledTwice);
            assert.isTrue(consoleInfoStub.calledWith('REDO (1)'));

            consoleInfoStub.restore();
        });
    });

    describe('#applyAction()', () => {
        it('pushes a new state for a provided `PUSH` action', () => {
            self.mockInit();

            const initialState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 0);

            self.stateManager.applyAction({
                type: ActionType.INSERT,
                content: 'o',
                range: {
                    from: 3,
                    to: 3
                }
            });

            const nextState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 1);
            assert.notEqual(initialState, nextState);
            assert.instanceOf(nextState, State);
            assert.isFrozen(nextState);
        });

        it('replaces a new state for a provided `REPLACE` action', () => {
            self.mockInit();

            const initialState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 0);

            self.stateManager.applyAction({
                type: ActionType.TOGGLE_INLINE,
                tag: MarkupTag.STRONG,
                range: {
                    from: 3,
                    to: 3
                }
            });

            const nextState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 0);
            assert.notEqual(initialState, nextState);
            assert.instanceOf(nextState, State);
            assert.isFrozen(nextState);
        });

        it('maintains the original state for a futile action', () => {
            self.mockInit();

            const initialState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 0);

            self.stateManager.applyAction({
                type: ActionType.COPY
            });

            const nextState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 0);
            assert.equal(initialState, nextState);
        });

        it('throws an error if the provided action does not return an instance of `State`', () => {
            const mockFailingCreator = (_, __) => null;

            self.stateManager = new StateManager(self.tome, mockFailingCreator);

            self.mockInit();

            assert.throws(() => self.stateManager.applyAction({}));
        });

        it('invokes `raiseIsActioningFrag()` for actions that cause mutations or selection changes', () => {
            const raiseIsActioningFlagSpy = self.tome.eventManager.raiseIsActioningFlag as sinon.SinonSpy;

            self.mockInit();

            assert.isTrue(raiseIsActioningFlagSpy.notCalled);

            self.stateManager.applyAction({
                type: ActionType.CHANGE_BLOCK_TYPE,
                tag: MarkupTag.H1,
                range: {
                    from: 0,
                    to: 0
                }
            });

            assert.isTrue(raiseIsActioningFlagSpy.called);
        });

        it('will not re-render or patch the DOM for `MUTATE` actions', () => {
            const renderSpy = self.tome.tree.render as sinon.SinonSpy;

            self.mockInit();

            assert.isTrue(renderSpy.calledOnce);

            self.stateManager.applyAction({
                type: ActionType.MUTATE
            });

            assert.isTrue(renderSpy.calledTwice);
            assert.deepEqual(renderSpy.secondCall.args, []);
        });

        it('invokes a consumer `onStateChange` callback if provided', () => {
            const callbackSpy = self.tome.config.callbacks.onStateChange = spy();

            self.mockInit();

            self.stateManager.applyAction({
                type: ActionType.MUTATE
            });

            assert.isTrue(callbackSpy.calledOnce);
            assert.isTrue(callbackSpy.calledWith(self.stateManager.state, ActionType.MUTATE));
        });

        it('logs to the `console.info()` if `debug` mode enabled', () => {
            self.tome.config.debug.enable = true;

            const consoleInfoStub = stub(console, 'info');

            self.mockInit();

            self.stateManager.applyAction({
                type: ActionType.MUTATE
            });

            assert.isTrue(consoleInfoStub.calledOnce);
            assert.isTrue(consoleInfoStub.calledWith(
                `PUSH (${self.stateManager.historyIndex}): ${ActionType.MUTATE}`
            ));

            consoleInfoStub.restore();
        });
    });

    describe('#getActionRage()', () => {
        it('aborts if no anchor node is provided via `window.getSelection()`', () => {
            self.getSelectionSpy = window.getSelection = spy(() => ({
                anchorNode: null
            }));

            self.mockInit();

            const initalState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 0);

            self.stateManager.applyAction({
                type: ActionType.SET_SELECTION
            });

            assert.equal(self.stateManager.historyIndex, 0);
            assert.equal(self.stateManager.state, initalState);
        });

        it('aborts if the anchor node provided by `window.getSelection()` is not a child of the editor', () => {
            self.getSelectionSpy = window.getSelection = spy(() => ({
                anchorNode: document.createElement('p')
            }));

            self.mockInit();

            const initalState = self.stateManager.state;

            assert.equal(self.stateManager.historyIndex, 0);

            self.stateManager.applyAction({
                type: ActionType.SET_SELECTION
            });

            assert.equal(self.stateManager.historyIndex, 0);
            assert.equal(self.stateManager.state, initalState);
        });

        it('maps the provided selection into a range for the action if valid', () => {
            const mockRange = new TomeSelection(3, 3);

            self.stateManager = new StateManager(self.tome, void 0, () => mockRange);

            self.mockInit();

            self.stateManager.applyAction({
                type: ActionType.SET_SELECTION,
                data: { type: null }
            });

            assert.deepEqual(self.stateManager.state.selection, mockRange);
        });

        it('aborts the action if the returned range is equal to the current selection', () => {
            const mockRange = new TomeSelection(0, 0);

            self.stateManager = new StateManager(self.tome, void 0, () => mockRange);

            self.mockInit();

            const initialState = self.stateManager.state;

            self.stateManager.applyAction({
                type: ActionType.SET_SELECTION
            });

            assert.equal(initialState, self.stateManager.state);
        });
    });

    describe('#pushStateToHistory()', () => {
        it('pushes the next state into the history and increments `historyIndex`', () => {
            self.mockInit();

            assert.equal(self.stateManager.historyIndex, 0);

            self.mockPushState();

            assert.equal(self.stateManager.historyIndex, 1);
        });

        it('shifts the history to accomodate a `PUSH` action when the history limit is reached', () => {
            self.tome.config.history.limit = 2;

            self.mockInit();

            assert.equal(self.stateManager.historyIndex, 0);

            self.mockPushState();

            assert.equal(self.stateManager.historyIndex, 1);

            self.mockPushState();

            assert.equal(self.stateManager.historyIndex, 1);
        });
    });

    describe('#resetCanPushTimer()', () => {
        it(
            'will treat a `PUSH` action as a `REPLACE` if it occurs within `DURATION_BLOCK_PUSH` of another action',
            async () => {
                self.mockInit();

                // @ts-ignore
                const delay = StateManager.DURATION_BLOCK_PUSH = 100;

                assert.equal(self.stateManager.historyIndex, 0);

                self.stateManager.applyAction(self.nextAction);

                assert.equal(self.stateManager.historyIndex, 1);

                self.stateManager.applyAction(self.nextAction);

                assert.equal(self.stateManager.historyIndex, 1);

                await new Promise(resolve => setTimeout(resolve, delay));

                self.stateManager.applyAction(self.nextAction);

                assert.equal(self.stateManager.historyIndex, 2);
                assert.equal(self.stateManager.state.text, 'fooooo');
            }
        );
    });

    it(
        'will `PUSH` at least every `DURATION_BACKUP` regardless',
        async () => {
            // @ts-ignore
            const durationBackup = StateManager.DURATION_BACKUP = 100;

            let iterations = 4;

            const delay = durationBackup / iterations;

            const applyActionAndWait = async () => {
                self.stateManager.applyAction(self.nextAction);

                assert.equal(self.stateManager.historyIndex, 1);

                await new Promise(resolve => setTimeout(resolve, delay));

                iterations--;

                await (iterations > 0 ? applyActionAndWait() : null);
            };

            self.mockInit();

            await applyActionAndWait();

            self.stateManager.applyAction(self.nextAction);

            assert.equal(self.stateManager.historyIndex, 2);
        }
    );

    describe('#getManipulationTypeForAction()', () => {
        // @ts-ignore
        const {getManipulationTypeForAction} = StateManager;

        it('returns `REPLACE` for an `INSERT`, `DELETE`, or `BACKSPACE` action', () => {
            const testCases: ActionType[] = [
                ActionType.INSERT,
                ActionType.DELETE,
                ActionType.BACKSPACE
            ];

            testCases.forEach(actionType => {
                const manipulation = getManipulationTypeForAction(
                    {type: actionType},
                    null,
                    false
                );

                assert.equal(manipulation, HistoryManipulationType.REPLACE);
            });
        });

        it('returns `PUSH` for an `INSERT` action if `canPushState` is `true`', () => {
            const manipulation = getManipulationTypeForAction(
                {type: ActionType.INSERT},
                null,
                true
            );

            assert.equal(manipulation, HistoryManipulationType.PUSH);
        });

        it('returns `PUSH` for an `INSERT` action if the last action type is `DELETE`, `BACKSPACE`, or `CUT`', () => {
            const testCases: ActionType[] = [
                ActionType.DELETE,
                ActionType.BACKSPACE,
                ActionType.CUT
            ];

            testCases.forEach(lastActionType => {
                const manipulation = getManipulationTypeForAction(
                    {type: ActionType.INSERT},
                    lastActionType,
                    false
                );

                assert.equal(manipulation, HistoryManipulationType.PUSH);
            });
        });

        it('returns `PUSH` for a `DELETE`, or `BACKSPACE` action if `canPushState` is `true`', () => {
            const testCases: ActionType[] = [
                ActionType.DELETE,
                ActionType.BACKSPACE
            ];

            testCases.forEach(actionType => {
                const manipulation = getManipulationTypeForAction(
                    {type: actionType},
                    null,
                    true
                );

                assert.equal(manipulation, HistoryManipulationType.PUSH);
            });
        });

        it(
            'returns `PUSH` for a `DELETE` or `BACKSPACE` action if the last action type is `INSERT`, or `PASTE`',
            () => {
                const testCases: ActionType[] = [
                    ActionType.INSERT,
                    ActionType.PASTE
                ];

                testCases.forEach(lastActionType => {
                    const manipulation = getManipulationTypeForAction(
                        {type: ActionType.DELETE},
                        lastActionType,
                        false
                    );

                    assert.equal(manipulation, HistoryManipulationType.PUSH);
                });

                testCases.forEach(lastActionType => {
                    const manipulation = getManipulationTypeForAction(
                        {type: ActionType.BACKSPACE},
                        lastActionType,
                        false
                    );

                    assert.equal(manipulation, HistoryManipulationType.PUSH);
                });
            }
        );

        it('returns `PUSH` for any `SET_SELECTION` action not generated by a `keydown` event', () => {
            const manipulation = getManipulationTypeForAction(
                {
                    type: ActionType.SET_SELECTION,
                    data: {type: null}
                },
                null,
                false
            );

            assert.equal(manipulation, HistoryManipulationType.PUSH);
        });

        it('returns `REPLACE` for a `SET_SELECTION` action generated by a `keydown` event', () => {
            const manipulation = getManipulationTypeForAction(
                {
                    type: ActionType.SET_SELECTION,
                    data: {type: 'keydown'}
                },
                null,
                false
            );

            assert.equal(manipulation, HistoryManipulationType.REPLACE);
        });

        it('returns `PUSH` for a `TOGGLE_INLINE` action with a non-collapsed range', () => {
            const manipulation = getManipulationTypeForAction(
                {
                    type: ActionType.TOGGLE_INLINE,
                    range: new TomeSelection(0, 10)
                },
                null,
                false
            );

            assert.equal(manipulation, HistoryManipulationType.PUSH);
        });

        it('returns `REPLACE` for a `TOGGLE_INLINE` action with a collapsed range', () => {
            const manipulation = getManipulationTypeForAction(
                {
                    type: ActionType.TOGGLE_INLINE,
                    range: new TomeSelection(0, 0)
                },
                null,
                false
            );

            assert.equal(manipulation, HistoryManipulationType.REPLACE);
        });
    });

    describe('#renderTreeToDom()', () => {
        it(
            'rethrows any errors caught during rendering or patching',
            () => {
                self.tome.tree.render = spy(() => {
                    throw new Error('test');
                });

                assert.throws(() => self.mockInit());
            }
        );

        it(
            'logs to `console.error()` if an error occurs during rendering or patching and `debug` mode is enabled',
            () => {
                self.tome.config.debug.enable = true;

                const consoleErrorStub = stub(console, 'error');

                self.tome.tree.render = spy(() => {
                    throw new Error('test');
                });

                assert.throws(() => self.mockInit());
                assert.isTrue(consoleErrorStub.called);

                consoleErrorStub.restore();
            }
        );
    });
});
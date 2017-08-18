class Util {

    /**
     * @param   {object} target
     * @param   {object} source
     * @param   {boolean} deep
     * @return  {object}
     */

    static extend(target, source, deep) {
        let sourceKeys = [];

        if (!target || typeof target !== 'object') {
            throw new TypeError('[Util#extend] Target must be a valid object');
        }

        deep = deep || false;

        if (Array.isArray(source)) {
            for (let i = 0; i < source.length; i++) {
                sourceKeys.push(i);
            }
        } else if (source) {
            sourceKeys = Object.keys(source);
        }

        for (let i = 0; i < sourceKeys.length; i++) {
            let key = sourceKeys[i];
            let descriptor = Object.getOwnPropertyDescriptor(source, key);

            // Skip computed properties

            if (typeof descriptor.get === 'function') continue;

            if (!deep || typeof source[key] !== 'object') {
                // All non-object primitives, or all properties if
                // shallow extend

                target[key] = source[key];
            } else if (Array.isArray(source[key])) {
                // Arrays

                if (!target[key]) {
                    target[key] = [];
                }

                this.extend(target[key], source[key], deep);
            } else {
                // Objects

                if (!target[key]) {
                    target[key] = {};
                }

                this.extend(target[key], source[key], deep);
            }
        }

        return target;
    }

    /**
     * Flattens an array.
     *
     * @param {Array} arr
     * @return {Array}
     */

    static flattenArray(arr) {
        return arr.reduce((prev, curr) => {
            if (Array.isArray(curr)) {
                return prev.concat(curr);
            }

            prev.push(curr);

            return prev;
        }, []);
    }

    /**
     * Returns a function which calls the provided function
     * only after the specified interval has elapsed between
     * function calls. An optional `immediate` boolean will
     * cause the provided function to be called once immediately
     * before waiting.
     *
     * @param   {function}  fn
     * @param   {number}    interval
     * @param   {boolean}   [immediate=false]
     * @return  {function}
     */

    static debounce(fn, interval, immediate) {
        let timeoutId = -1;

        return function() {
            const args = arguments;

            const later = () => {
                timeoutId = -1;

                fn.apply(this, args); // eslint-disable-line no-invalid-this
            };

            if (timeoutId < 0 && immediate) {
                later();
            } else {
                clearTimeout(timeoutId);

                timeoutId = setTimeout(later, interval);
            }
        };
    }

    /**
     * Returns a function which calls the provided function once per maximum
     * specified interval.
     *
     * @param   {function}  fn
     * @param   {number}    interval
     * @return  {function}
     */

    static throttle(fn, interval) {
        let timeoutId = -1;
        let last = -1;

        return function() {
            const args = arguments;
            const now = Date.now();
            const difference = last ? now - last : Infinity;

            const later = () => {
                last = now;

                fn.apply(this, args); // eslint-disable-line no-invalid-this
            };

            if (!last || difference >= interval) {
                later();
            } else {
                clearTimeout(timeoutId);

                timeoutId = setTimeout(later, interval - difference);
            }
        };
    }

    /**
     * @param   {HTMLElement}       el
     * @param   {string}            selector
     * @param   {boolean}           [includeSelf]
     * @return  {HTMLElement|null}
     */

    static closestParent(el, selector, includeSelf) {
        let parent = el.parentNode;

        if (includeSelf && el.matches(selector)) {
            return el;
        }

        while (parent && parent !== document.body) {
            if (parent.matches && parent.matches(selector)) {
                return parent;
            } else if (parent.parentNode) {
                parent = parent.parentNode;
            } else {
                return null;
            }
        }

        return null;
    }

    /**
     * @param   {Element}     el
     * @param   {string}      selector
     * @return  {Element[]}
     */

    static children(el, selector) {
        const selectors = selector.split(',');
        const childSelectors = [];

        let children = null;
        let tempId   = '';

        if (!el.id) {
            tempId = '_temp_';

            el.id = tempId;
        }

        while (selectors.length) {
            childSelectors.push('#' + el.id + '>' + selectors.pop());
        }

        children = document.querySelectorAll(childSelectors.join(', '));

        if (tempId) {
            el.removeAttribute('id');
        }

        return children;
    }

    /**
     * @param   {Node}        node
     * @param   {boolean}     [includeNonElements=false]
     * @return  {Element[]}
     */

    static index(node, includeNonElements=false) {
        let index = 0;

        while ((node = includeNonElements ? node.previousSibling : node.previousElementSibling) !== null) {
            index++;
        }

        return index;
    }

    /**
     * Converts a dash or snake-case string to camel case.
     *
     * @param   {string}    str
     * @return  {string}
     */

    static camelCase(str) {
        return str.toLowerCase()
            .replace(/([_-][a-z0-9])/g, $1 => $1.toUpperCase().replace(/[_-]/, ''));
    }

    /**
     * Converts a dash or snake-case string to pascal case.
     *
     * @param   {string}    str
     * @return  {string}
     */

    static pascalCase(str) {
        return (str = Util.camelCase(str))
            .charAt(0)
            .toUpperCase() + str.slice(1);
    }

    /**
     * Converts a camel or pascal-case string to dash case.
     *
     * @param   {string}    str
     * @return  {string}
     */

    static dashCase(str) {
        return str.replace(/([A-Z])/g, '-$1')
            .replace(/^-/, '')
            .toLowerCase();
    }

    /**
     * Compares two arrays of indices, returning `true` if `pathOne` points
     * to a node at a greater position in the tree.
     *
     * @param  {Array.<number>} pathOne
     * @param  {Array.<number>} pathTwo
     * @return {boolean}
     */

    static isGreaterPath(pathOne, pathTwo) {
        let index    = 0;
        let valueOne = pathOne[index];
        let valueTwo = pathTwo[index];

        while (typeof valueOne === 'number' && typeof valueTwo === 'number') {
            if (valueOne > valueTwo) {
                return true;
            }

            index++;

            valueOne = pathOne[index];
            valueTwo = pathTwo[index];
        }

        return false;
    }
}

export default Util;
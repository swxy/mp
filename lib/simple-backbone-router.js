let started = false;

const Reg = {
    optionalParam: /\((.*?)\)/g,
    namedParam: /(\(\?)?:\w+/g,
    splatParam: /\*\w+/g,
    escapeRegExp: /[\-{}\[\]+?.,\\\^$|#\s]/g,
    routeStripper: /^[#\/]|\s+$/g,
    pathStripper: /#.*$/
};

const Util = {
    extend (target, obj, ...args) {
        if (!obj) {
            return target;
        }
        if (args.length) {
            let argsArr = [...args];
            let result = Util.extend(target, argsArr.pop());
            return Util.extend.apply(null, [result, obj, ...argsArr]);
        }
        for (let item in obj) {
            obj.hasOwnProperty(item) && obj[item] && (target[item] = obj[item]);
        }
        return obj;
    },
    any (obj, callback) {
        for (let item of obj) {
            if (callback(item)) {
                return true;
            }
        }
        return false;
    }
};

class History {
    constructor() {
        this.handlers = [];
        this.location = window.location;
        this.history = window.history;
    }

    getHash() {
        return window.location.hash;
    }

    getFragment(fragment) {
        return (fragment || this.getHash()).replace(Reg.routeStripper, '');
    }

    start(options) {
        if (started) {
            console.error('History started');
            return;
        }
        started = true;
        this.options = Util.extend({root: '/'}, options);
        this.root = this.options.root;

        this.fragment = this.getFragment();

        this.bindEvent();

        if (!this.options.silent) {
            return this.loadUrl();
        }
    }

    route(router, callback) {
        this.handlers.unshift({route: router, callback: callback});
    }

    bindEvent() {
        window.addEventListener('hashchange', this.checkUrl.bind(this));
    }

    unbindEvent() {
        window.removeEventListener('hashchange', this.checkUrl.bind(this));
    }

    checkUrl() {
        let current = this.getFragment();
        if (current === this.fragment) return false;
        this.loadUrl();
    }

    loadUrl(fragment) {
        fragment = this.fragment = this.getFragment(fragment);
        return Util.any(this.handlers, function (handler) {
            if (handler.route.test(fragment)) {
                handler.callback(fragment);
                return true;
            }
        });
    }

    navigate(fragment, option) {
        if (!started) return false;
        if (!option || option === true) {
            option = {trigger: !!option};
        }
        let url = this.root + (fragment = this.getFragment(fragment || ''));
        fragment.replace(Reg.pathStripper, '');

        if (this.fragment === fragment) {
            return;
        }
        this.fragment = fragment;

        // Don't include a trailing slash on the root.
        if (fragment === '' && url !== '/') {
            url = url.slice(0, -1);
        }

        this.updateHash(this.location, fragment, options.replace);
        if (options.trigger) {
            return this.loadUrl(fragment);
        }
    }

    updateHash(location, fragment, replace) {
        if (replace) {
            var href = location.href.replace(/(javascript:|#).*$/, '');
            location.replace(href + '#' + fragment);
        } else {
            // Some browsers require that `hash` contains a leading #.
            location.hash = '#' + fragment;
        }
    }
}

const history = new History();

class Router {
    constructor(options = {}) {
        if (options.routes) {
            this.routes = options.routes;
        }
        this.bindRoutes();
    }

    route(route, name, callback) {
        if (!(route instanceof RegExp)) {
            route = this.routeToRegExp(route);
        }
        if (typeof name === 'function') {
            callback = name;
            name = '';
        }
        if (!callback) {
            callback = this[name];
        }

        var that = this;
        history.route(route, function (fragment) {
            let args = that.extractParameters(route, fragment);
            that.execute(callback, args);
            console.log('route:' + name);
        });
        return this;
    }

    execute(callback, args) {
        if (callback) {
            callback.apply(this, args);
        }
    }

    navigate(fragment, options) {
        history.navigate(fragment, options);
        return this;
    }

    bindRoutes() {
        if (!this.routes) {
            return;
        }
        let routes = Object.keys(this.routes);
        let route;
        while ((route = routes.pop()) != null) {
            this.route(route, this.routes[route]);
        }
    }

    routeToRegExp(route) {
        route = route.replace(Reg.escapeRegExp, '\\$&')
            .replace(Reg.optionalParam, '(?:$1)?')
            .replace(Reg.namedParam, function (match, optional) {
                return optional ? match : '([^/?]+)';
            })
            .replace(Reg.splatParam, '([^?]*?)');
        return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    }

    extractParameters(route, fragment) {
        var params = route.exec(fragment).slice(1);
        return params.map((param, i) => {
            if (i === params.length - 1) return param || null;
            return param ? decodeURIComponent(param) : null;
        });
    }
}

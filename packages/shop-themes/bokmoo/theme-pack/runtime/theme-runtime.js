(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // theme-host:react
  var React = globalThis.__JIFFOO_THEME_HOST__?.React;
  if (!React) {
    throw new Error("Theme runtime host bridge is missing React");
  }
  var react_default = React;
  var Children = React.Children;
  var Component = React.Component;
  var Fragment = React.Fragment;
  var Suspense = React.Suspense;
  var cloneElement = React.cloneElement;
  var createContext = React.createContext;
  var createElement = React.createElement;
  var createRef = React.createRef;
  var forwardRef = React.forwardRef;
  var isValidElement = React.isValidElement;
  var lazy = React.lazy;
  var memo = React.memo;
  var startTransition = React.startTransition;
  var useCallback = React.useCallback;
  var useContext = React.useContext;
  var useDeferredValue = React.useDeferredValue;
  var useEffect = React.useEffect;
  var useId = React.useId;
  var useImperativeHandle = React.useImperativeHandle;
  var useInsertionEffect = React.useInsertionEffect || React.useLayoutEffect;
  var useLayoutEffect = React.useLayoutEffect;
  var useMemo = React.useMemo;
  var useReducer = React.useReducer;
  var useRef = React.useRef;
  var useState = React.useState;
  var useTransition = React.useTransition;

  // ../../../node_modules/lucide-react/dist/esm/shared/src/utils.js
  var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  var mergeClasses = (...classes) => classes.filter((className, index, array) => {
    return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
  }).join(" ").trim();

  // ../../../node_modules/lucide-react/dist/esm/defaultAttributes.js
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  // ../../../node_modules/lucide-react/dist/esm/Icon.js
  var Icon = forwardRef(
    ({
      color: color2 = "currentColor",
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      className = "",
      children,
      iconNode,
      ...rest
    }, ref) => {
      return createElement(
        "svg",
        {
          ref,
          ...defaultAttributes,
          width: size,
          height: size,
          stroke: color2,
          strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
          className: mergeClasses("lucide", className),
          ...rest
        },
        [
          ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
          ...Array.isArray(children) ? children : [children]
        ]
      );
    }
  );

  // ../../../node_modules/lucide-react/dist/esm/createLucideIcon.js
  var createLucideIcon = (iconName, iconNode) => {
    const Component2 = forwardRef(
      ({ className, ...props }, ref) => createElement(Icon, {
        ref,
        iconNode,
        className: mergeClasses(`lucide-${toKebabCase(iconName)}`, className),
        ...props
      })
    );
    Component2.displayName = `${iconName}`;
    return Component2;
  };

  // ../../../node_modules/lucide-react/dist/esm/icons/apple.js
  var Apple = createLucideIcon("Apple", [
    [
      "path",
      {
        d: "M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z",
        key: "3s7exb"
      }
    ],
    ["path", { d: "M10 2c1 .5 2 2 2 5", key: "fcco2y" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/arrow-left-right.js
  var ArrowLeftRight = createLucideIcon("ArrowLeftRight", [
    ["path", { d: "M8 3 4 7l4 4", key: "9rb6wj" }],
    ["path", { d: "M4 7h16", key: "6tx8e3" }],
    ["path", { d: "m16 21 4-4-4-4", key: "siv7j2" }],
    ["path", { d: "M20 17H4", key: "h6l3hr" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/arrow-left.js
  var ArrowLeft = createLucideIcon("ArrowLeft", [
    ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
    ["path", { d: "M19 12H5", key: "x3x0zl" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/arrow-right.js
  var ArrowRight = createLucideIcon("ArrowRight", [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/book-open.js
  var BookOpen = createLucideIcon("BookOpen", [
    ["path", { d: "M12 7v14", key: "1akyts" }],
    [
      "path",
      {
        d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
        key: "ruj8y"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/calendar-days.js
  var CalendarDays = createLucideIcon("CalendarDays", [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 14h.01", key: "6423bh" }],
    ["path", { d: "M12 14h.01", key: "1etili" }],
    ["path", { d: "M16 14h.01", key: "1gbofw" }],
    ["path", { d: "M8 18h.01", key: "lrp35t" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }],
    ["path", { d: "M16 18h.01", key: "kzsmim" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/check.js
  var Check = createLucideIcon("Check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chevron-down.js
  var ChevronDown = createLucideIcon("ChevronDown", [
    ["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chevron-left.js
  var ChevronLeft = createLucideIcon("ChevronLeft", [
    ["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chevron-right.js
  var ChevronRight = createLucideIcon("ChevronRight", [
    ["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/chrome.js
  var Chrome = createLucideIcon("Chrome", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["line", { x1: "21.17", x2: "12", y1: "8", y2: "8", key: "a0cw5f" }],
    ["line", { x1: "3.95", x2: "8.54", y1: "6.06", y2: "14", key: "1kftof" }],
    ["line", { x1: "10.88", x2: "15.46", y1: "21.94", y2: "14", key: "1ymyh8" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/circle-check.js
  var CircleCheck = createLucideIcon("CircleCheck", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/circle-help.js
  var CircleHelp = createLucideIcon("CircleHelp", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/circle-x.js
  var CircleX = createLucideIcon("CircleX", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "m9 9 6 6", key: "z0biqf" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/clock-3.js
  var Clock3 = createLucideIcon("Clock3", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 16.5 12", key: "1aq6pp" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/copy.js
  var Copy = createLucideIcon("Copy", [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/credit-card.js
  var CreditCard = createLucideIcon("CreditCard", [
    ["rect", { width: "20", height: "14", x: "2", y: "5", rx: "2", key: "ynyp8z" }],
    ["line", { x1: "2", x2: "22", y1: "10", y2: "10", key: "1b3vmo" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/crown.js
  var Crown = createLucideIcon("Crown", [
    [
      "path",
      {
        d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",
        key: "1vdc57"
      }
    ],
    ["path", { d: "M5 21h14", key: "11awu3" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/earth.js
  var Earth = createLucideIcon("Earth", [
    ["path", { d: "M21.54 15H17a2 2 0 0 0-2 2v4.54", key: "1djwo0" }],
    [
      "path",
      {
        d: "M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17",
        key: "1tzkfa"
      }
    ],
    ["path", { d: "M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05", key: "14pb5j" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/external-link.js
  var ExternalLink = createLucideIcon("ExternalLink", [
    ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
    ["path", { d: "M10 14 21 3", key: "gplh6r" }],
    ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/eye-off.js
  var EyeOff = createLucideIcon("EyeOff", [
    [
      "path",
      {
        d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
        key: "ct8e1f"
      }
    ],
    ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
    [
      "path",
      {
        d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
        key: "13bj9a"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/eye.js
  var Eye = createLucideIcon("Eye", [
    [
      "path",
      {
        d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
        key: "1nclc0"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/grid-3x3.js
  var Grid3x3 = createLucideIcon("Grid3x3", [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/headphones.js
  var Headphones = createLucideIcon("Headphones", [
    [
      "path",
      {
        d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
        key: "1xhozi"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/house.js
  var House = createLucideIcon("House", [
    ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", key: "5wwlr5" }],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        key: "1d0kgt"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/layers.js
  var Layers = createLucideIcon("Layers", [
    [
      "path",
      {
        d: "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
        key: "8b97xw"
      }
    ],
    ["path", { d: "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65", key: "dd6zsq" }],
    ["path", { d: "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65", key: "ep9fru" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/layout-grid.js
  var LayoutGrid = createLucideIcon("LayoutGrid", [
    ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1", key: "1g98yp" }],
    ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1", key: "6d4xhi" }],
    ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1", key: "nxv5o0" }],
    ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/life-buoy.js
  var LifeBuoy = createLucideIcon("LifeBuoy", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m4.93 4.93 4.24 4.24", key: "1ymg45" }],
    ["path", { d: "m14.83 9.17 4.24-4.24", key: "1cb5xl" }],
    ["path", { d: "m14.83 14.83 4.24 4.24", key: "q42g0n" }],
    ["path", { d: "m9.17 14.83-4.24 4.24", key: "bqpfvv" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/link-2.js
  var Link2 = createLucideIcon("Link2", [
    ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2", key: "8i5ue5" }],
    ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2", key: "1b9ql8" }],
    ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/list.js
  var List = createLucideIcon("List", [
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M3 18h.01", key: "1tta3j" }],
    ["path", { d: "M3 6h.01", key: "1rqtza" }],
    ["path", { d: "M8 12h13", key: "1za7za" }],
    ["path", { d: "M8 18h13", key: "1lx6n3" }],
    ["path", { d: "M8 6h13", key: "ik3vkj" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/loader-circle.js
  var LoaderCircle = createLucideIcon("LoaderCircle", [
    ["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/lock-keyhole.js
  var LockKeyhole = createLucideIcon("LockKeyhole", [
    ["circle", { cx: "12", cy: "16", r: "1", key: "1au0dj" }],
    ["rect", { x: "3", y: "10", width: "18", height: "12", rx: "2", key: "6s8ecr" }],
    ["path", { d: "M7 10V7a5 5 0 0 1 10 0v3", key: "1pqi11" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/mail.js
  var Mail = createLucideIcon("Mail", [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/map-pin.js
  var MapPin = createLucideIcon("MapPin", [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
        key: "1r0f0z"
      }
    ],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/menu.js
  var Menu = createLucideIcon("Menu", [
    ["line", { x1: "4", x2: "20", y1: "12", y2: "12", key: "1e0a9i" }],
    ["line", { x1: "4", x2: "20", y1: "6", y2: "6", key: "1owob3" }],
    ["line", { x1: "4", x2: "20", y1: "18", y2: "18", key: "yk5zj1" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/minus.js
  var Minus = createLucideIcon("Minus", [["path", { d: "M5 12h14", key: "1ays0h" }]]);

  // ../../../node_modules/lucide-react/dist/esm/icons/package-2.js
  var Package2 = createLucideIcon("Package2", [
    ["path", { d: "M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z", key: "1ront0" }],
    ["path", { d: "m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9", key: "19h2x1" }],
    ["path", { d: "M12 3v6", key: "1holv5" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/package-check.js
  var PackageCheck = createLucideIcon("PackageCheck", [
    ["path", { d: "m16 16 2 2 4-4", key: "gfu2re" }],
    [
      "path",
      {
        d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
        key: "e7tb2h"
      }
    ],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "12", key: "a4e8g8" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/package.js
  var Package = createLucideIcon("Package", [
    [
      "path",
      {
        d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
        key: "1a0edw"
      }
    ],
    ["path", { d: "M12 22V12", key: "d0xqtd" }],
    ["path", { d: "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7", key: "yx3hmr" }],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/pencil-line.js
  var PencilLine = createLucideIcon("PencilLine", [
    ["path", { d: "M12 20h9", key: "t2du7b" }],
    [
      "path",
      {
        d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
        key: "1ykcvy"
      }
    ],
    ["path", { d: "m15 5 3 3", key: "1w25hb" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/phone.js
  var Phone = createLucideIcon("Phone", [
    [
      "path",
      {
        d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
        key: "foiqr5"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/plane.js
  var Plane = createLucideIcon("Plane", [
    [
      "path",
      {
        d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
        key: "1v9wt8"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/plus.js
  var Plus = createLucideIcon("Plus", [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "M12 5v14", key: "s699le" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/qr-code.js
  var QrCode = createLucideIcon("QrCode", [
    ["rect", { width: "5", height: "5", x: "3", y: "3", rx: "1", key: "1tu5fj" }],
    ["rect", { width: "5", height: "5", x: "16", y: "3", rx: "1", key: "1v8r4q" }],
    ["rect", { width: "5", height: "5", x: "3", y: "16", rx: "1", key: "1x03jg" }],
    ["path", { d: "M21 16h-3a2 2 0 0 0-2 2v3", key: "177gqh" }],
    ["path", { d: "M21 21v.01", key: "ents32" }],
    ["path", { d: "M12 7v3a2 2 0 0 1-2 2H7", key: "8crl2c" }],
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M12 3h.01", key: "n36tog" }],
    ["path", { d: "M12 16v.01", key: "133mhm" }],
    ["path", { d: "M16 12h1", key: "1slzba" }],
    ["path", { d: "M21 12v.01", key: "1lwtk9" }],
    ["path", { d: "M12 21v-1", key: "1880an" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/receipt-text.js
  var ReceiptText = createLucideIcon("ReceiptText", [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M14 8H8", key: "1l3xfs" }],
    ["path", { d: "M16 12H8", key: "1fr5h0" }],
    ["path", { d: "M13 16H8", key: "wsln4y" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/refresh-cw.js
  var RefreshCw = createLucideIcon("RefreshCw", [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
    ["path", { d: "M8 16H3v5", key: "1cv678" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/save.js
  var Save = createLucideIcon("Save", [
    [
      "path",
      {
        d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
        key: "1c8476"
      }
    ],
    ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }],
    ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/search.js
  var Search = createLucideIcon("Search", [
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/settings.js
  var Settings = createLucideIcon("Settings", [
    [
      "path",
      {
        d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
        key: "1qme2f"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/shield-check.js
  var ShieldCheck = createLucideIcon("ShieldCheck", [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/shopping-bag.js
  var ShoppingBag = createLucideIcon("ShoppingBag", [
    ["path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", key: "hou9p0" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M16 10a4 4 0 0 1-8 0", key: "1ltviw" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/shopping-cart.js
  var ShoppingCart = createLucideIcon("ShoppingCart", [
    ["circle", { cx: "8", cy: "21", r: "1", key: "jimo8o" }],
    ["circle", { cx: "19", cy: "21", r: "1", key: "13723u" }],
    [
      "path",
      {
        d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
        key: "9zh506"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/signal.js
  var Signal = createLucideIcon("Signal", [
    ["path", { d: "M2 20h.01", key: "4haj6o" }],
    ["path", { d: "M7 20v-4", key: "j294jx" }],
    ["path", { d: "M12 20v-8", key: "i3yub9" }],
    ["path", { d: "M17 20V8", key: "1tkaf5" }],
    ["path", { d: "M22 4v16", key: "sih9yq" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/smartphone.js
  var Smartphone = createLucideIcon("Smartphone", [
    ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2", key: "1yt0o3" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/star.js
  var Star = createLucideIcon("Star", [
    [
      "path",
      {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
        key: "r04s7s"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/trash-2.js
  var Trash2 = createLucideIcon("Trash2", [
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
    ["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
    ["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/triangle-alert.js
  var TriangleAlert = createLucideIcon("TriangleAlert", [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        key: "wmoenq"
      }
    ],
    ["path", { d: "M12 9v4", key: "juzpu7" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/user-plus.js
  var UserPlus = createLucideIcon("UserPlus", [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
    ["line", { x1: "19", x2: "19", y1: "8", y2: "14", key: "1bvyxn" }],
    ["line", { x1: "22", x2: "16", y1: "11", y2: "11", key: "1shjgl" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/user-round.js
  var UserRound = createLucideIcon("UserRound", [
    ["circle", { cx: "12", cy: "8", r: "5", key: "1hypcn" }],
    ["path", { d: "M20 21a8 8 0 0 0-16 0", key: "rfgkzh" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/users-round.js
  var UsersRound = createLucideIcon("UsersRound", [
    ["path", { d: "M18 21a8 8 0 0 0-16 0", key: "3ypg7q" }],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["path", { d: "M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3", key: "10s06x" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/users.js
  var Users = createLucideIcon("Users", [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
    ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/wallet-cards.js
  var WalletCards = createLucideIcon("WalletCards", [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2", key: "4125el" }],
    [
      "path",
      {
        d: "M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21",
        key: "1dpki6"
      }
    ]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/wallet.js
  var Wallet = createLucideIcon("Wallet", [
    [
      "path",
      {
        d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
        key: "18etb6"
      }
    ],
    ["path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4", key: "xoc0q4" }]
  ]);

  // ../../../node_modules/lucide-react/dist/esm/icons/x.js
  var X = createLucideIcon("X", [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ]);

  // theme-host:react/jsx-runtime
  var runtime = globalThis.__JIFFOO_THEME_HOST__?.jsxRuntime;
  if (!runtime) {
    throw new Error("Theme runtime host bridge is missing react/jsx-runtime");
  }
  var Fragment2 = runtime.Fragment;
  var jsx = runtime.jsx;
  var jsxs = runtime.jsxs;
  var jsxDEV = runtime.jsxDEV;

  // ../../../node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs
  var LayoutGroupContext = createContext({});

  // ../../../node_modules/framer-motion/dist/es/utils/use-constant.mjs
  function useConstant(init) {
    const ref = useRef(null);
    if (ref.current === null) {
      ref.current = init();
    }
    return ref.current;
  }

  // ../../../node_modules/framer-motion/dist/es/context/PresenceContext.mjs
  var PresenceContext = createContext(null);

  // ../../../node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs
  var MotionConfigContext = createContext({
    transformPagePoint: (p) => p,
    isStatic: false,
    reducedMotion: "never"
  });

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs
  var PopChildMeasure = class extends Component {
    getSnapshotBeforeUpdate(prevProps) {
      const element = this.props.childRef.current;
      if (element && prevProps.isPresent && !this.props.isPresent) {
        const size = this.props.sizeRef.current;
        size.height = element.offsetHeight || 0;
        size.width = element.offsetWidth || 0;
        size.top = element.offsetTop;
        size.left = element.offsetLeft;
      }
      return null;
    }
    /**
     * Required with getSnapshotBeforeUpdate to stop React complaining.
     */
    componentDidUpdate() {
    }
    render() {
      return this.props.children;
    }
  };
  function PopChild({ children, isPresent }) {
    const id3 = useId();
    const ref = useRef(null);
    const size = useRef({
      width: 0,
      height: 0,
      top: 0,
      left: 0
    });
    const { nonce } = useContext(MotionConfigContext);
    useInsertionEffect(() => {
      const { width, height, top, left } = size.current;
      if (isPresent || !ref.current || !width || !height)
        return;
      ref.current.dataset.motionPopId = id3;
      const style = document.createElement("style");
      if (nonce)
        style.nonce = nonce;
      document.head.appendChild(style);
      if (style.sheet) {
        style.sheet.insertRule(`
          [data-motion-pop-id="${id3}"] {
            position: absolute !important;
            width: ${width}px !important;
            height: ${height}px !important;
            top: ${top}px !important;
            left: ${left}px !important;
          }
        `);
      }
      return () => {
        document.head.removeChild(style);
      };
    }, [isPresent]);
    return jsx(PopChildMeasure, { isPresent, childRef: ref, sizeRef: size, children: cloneElement(children, { ref }) });
  }

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs
  var PresenceChild = ({ children, initial, isPresent, onExitComplete, custom, presenceAffectsLayout, mode }) => {
    const presenceChildren = useConstant(newChildrenMap);
    const id3 = useId();
    const memoizedOnExitComplete = useCallback((childId) => {
      presenceChildren.set(childId, true);
      for (const isComplete of presenceChildren.values()) {
        if (!isComplete)
          return;
      }
      onExitComplete && onExitComplete();
    }, [presenceChildren, onExitComplete]);
    const context = useMemo(
      () => ({
        id: id3,
        initial,
        isPresent,
        custom,
        onExitComplete: memoizedOnExitComplete,
        register: (childId) => {
          presenceChildren.set(childId, false);
          return () => presenceChildren.delete(childId);
        }
      }),
      /**
       * If the presence of a child affects the layout of the components around it,
       * we want to make a new context value to ensure they get re-rendered
       * so they can detect that layout change.
       */
      presenceAffectsLayout ? [Math.random(), memoizedOnExitComplete] : [isPresent, memoizedOnExitComplete]
    );
    useMemo(() => {
      presenceChildren.forEach((_, key) => presenceChildren.set(key, false));
    }, [isPresent]);
    useEffect(() => {
      !isPresent && !presenceChildren.size && onExitComplete && onExitComplete();
    }, [isPresent]);
    if (mode === "popLayout") {
      children = jsx(PopChild, { isPresent, children });
    }
    return jsx(PresenceContext.Provider, { value: context, children });
  };
  function newChildrenMap() {
    return /* @__PURE__ */ new Map();
  }

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs
  function usePresence(subscribe = true) {
    const context = useContext(PresenceContext);
    if (context === null)
      return [true, null];
    const { isPresent, onExitComplete, register } = context;
    const id3 = useId();
    useEffect(() => {
      if (subscribe)
        register(id3);
    }, [subscribe]);
    const safeToRemove = useCallback(() => subscribe && onExitComplete && onExitComplete(id3), [id3, onExitComplete, subscribe]);
    return !isPresent && onExitComplete ? [false, safeToRemove] : [true];
  }

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/utils.mjs
  var getChildKey = (child) => child.key || "";
  function onlyElements(children) {
    const filtered = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child))
        filtered.push(child);
    });
    return filtered;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/is-browser.mjs
  var isBrowser = typeof window !== "undefined";

  // ../../../node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs
  var useIsomorphicLayoutEffect = isBrowser ? useLayoutEffect : useEffect;

  // ../../../node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs
  var AnimatePresence = ({ children, custom, initial = true, onExitComplete, presenceAffectsLayout = true, mode = "sync", propagate = false }) => {
    const [isParentPresent, safeToRemove] = usePresence(propagate);
    const presentChildren = useMemo(() => onlyElements(children), [children]);
    const presentKeys = propagate && !isParentPresent ? [] : presentChildren.map(getChildKey);
    const isInitialRender = useRef(true);
    const pendingPresentChildren = useRef(presentChildren);
    const exitComplete = useConstant(() => /* @__PURE__ */ new Map());
    const [diffedChildren, setDiffedChildren] = useState(presentChildren);
    const [renderedChildren, setRenderedChildren] = useState(presentChildren);
    useIsomorphicLayoutEffect(() => {
      isInitialRender.current = false;
      pendingPresentChildren.current = presentChildren;
      for (let i = 0; i < renderedChildren.length; i++) {
        const key = getChildKey(renderedChildren[i]);
        if (!presentKeys.includes(key)) {
          if (exitComplete.get(key) !== true) {
            exitComplete.set(key, false);
          }
        } else {
          exitComplete.delete(key);
        }
      }
    }, [renderedChildren, presentKeys.length, presentKeys.join("-")]);
    const exitingChildren = [];
    if (presentChildren !== diffedChildren) {
      let nextChildren = [...presentChildren];
      for (let i = 0; i < renderedChildren.length; i++) {
        const child = renderedChildren[i];
        const key = getChildKey(child);
        if (!presentKeys.includes(key)) {
          nextChildren.splice(i, 0, child);
          exitingChildren.push(child);
        }
      }
      if (mode === "wait" && exitingChildren.length) {
        nextChildren = exitingChildren;
      }
      setRenderedChildren(onlyElements(nextChildren));
      setDiffedChildren(presentChildren);
      return;
    }
    if (mode === "wait" && renderedChildren.length > 1) {
      console.warn(`You're attempting to animate multiple children within AnimatePresence, but its mode is set to "wait". This will lead to odd visual behaviour.`);
    }
    const { forceRender } = useContext(LayoutGroupContext);
    return jsx(Fragment2, { children: renderedChildren.map((child) => {
      const key = getChildKey(child);
      const isPresent = propagate && !isParentPresent ? false : presentChildren === renderedChildren || presentKeys.includes(key);
      const onExit = () => {
        if (exitComplete.has(key)) {
          exitComplete.set(key, true);
        } else {
          return;
        }
        let isEveryExitComplete = true;
        exitComplete.forEach((isExitComplete) => {
          if (!isExitComplete)
            isEveryExitComplete = false;
        });
        if (isEveryExitComplete) {
          forceRender === null || forceRender === void 0 ? void 0 : forceRender();
          setRenderedChildren(pendingPresentChildren.current);
          propagate && (safeToRemove === null || safeToRemove === void 0 ? void 0 : safeToRemove());
          onExitComplete && onExitComplete();
        }
      };
      return jsx(PresenceChild, { isPresent, initial: !isInitialRender.current || initial ? void 0 : false, custom: isPresent ? void 0 : custom, presenceAffectsLayout, mode, onExitComplete: isPresent ? void 0 : onExit, children: child }, key);
    }) });
  };

  // ../../../node_modules/motion-utils/dist/es/noop.mjs
  var noop = /* @__NO_SIDE_EFFECTS__ */ (any) => any;

  // ../../../node_modules/motion-utils/dist/es/errors.mjs
  var warning = noop;
  var invariant = noop;
  if (true) {
    warning = (check, message) => {
      if (!check && typeof console !== "undefined") {
        console.warn(message);
      }
    };
    invariant = (check, message) => {
      if (!check) {
        throw new Error(message);
      }
    };
  }

  // ../../../node_modules/motion-utils/dist/es/memo.mjs
  // @__NO_SIDE_EFFECTS__
  function memo2(callback) {
    let result;
    return () => {
      if (result === void 0)
        result = callback();
      return result;
    };
  }

  // ../../../node_modules/motion-utils/dist/es/progress.mjs
  var progress = /* @__NO_SIDE_EFFECTS__ */ (from, to, value) => {
    const toFromDifference = to - from;
    return toFromDifference === 0 ? 1 : (value - from) / toFromDifference;
  };

  // ../../../node_modules/motion-utils/dist/es/time-conversion.mjs
  var secondsToMilliseconds = /* @__NO_SIDE_EFFECTS__ */ (seconds) => seconds * 1e3;
  var millisecondsToSeconds = /* @__NO_SIDE_EFFECTS__ */ (milliseconds) => milliseconds / 1e3;

  // ../../../node_modules/framer-motion/dist/es/utils/GlobalConfig.mjs
  var MotionGlobalConfig = {
    skipAnimations: false,
    useManualTiming: false
  };

  // ../../../node_modules/framer-motion/dist/es/frameloop/render-step.mjs
  function createRenderStep(runNextFrame) {
    let thisFrame = /* @__PURE__ */ new Set();
    let nextFrame = /* @__PURE__ */ new Set();
    let isProcessing = false;
    let flushNextFrame = false;
    const toKeepAlive = /* @__PURE__ */ new WeakSet();
    let latestFrameData = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    function triggerCallback(callback) {
      if (toKeepAlive.has(callback)) {
        step.schedule(callback);
        runNextFrame();
      }
      callback(latestFrameData);
    }
    const step = {
      /**
       * Schedule a process to run on the next frame.
       */
      schedule: (callback, keepAlive = false, immediate = false) => {
        const addToCurrentFrame = immediate && isProcessing;
        const queue = addToCurrentFrame ? thisFrame : nextFrame;
        if (keepAlive)
          toKeepAlive.add(callback);
        if (!queue.has(callback))
          queue.add(callback);
        return callback;
      },
      /**
       * Cancel the provided callback from running on the next frame.
       */
      cancel: (callback) => {
        nextFrame.delete(callback);
        toKeepAlive.delete(callback);
      },
      /**
       * Execute all schedule callbacks.
       */
      process: (frameData2) => {
        latestFrameData = frameData2;
        if (isProcessing) {
          flushNextFrame = true;
          return;
        }
        isProcessing = true;
        [thisFrame, nextFrame] = [nextFrame, thisFrame];
        thisFrame.forEach(triggerCallback);
        thisFrame.clear();
        isProcessing = false;
        if (flushNextFrame) {
          flushNextFrame = false;
          step.process(frameData2);
        }
      }
    };
    return step;
  }

  // ../../../node_modules/framer-motion/dist/es/frameloop/batcher.mjs
  var stepsOrder = [
    "read",
    // Read
    "resolveKeyframes",
    // Write/Read/Write/Read
    "update",
    // Compute
    "preRender",
    // Compute
    "render",
    // Write
    "postRender"
    // Compute
  ];
  var maxElapsed = 40;
  function createRenderBatcher(scheduleNextBatch, allowKeepAlive) {
    let runNextFrame = false;
    let useDefaultElapsed = true;
    const state = {
      delta: 0,
      timestamp: 0,
      isProcessing: false
    };
    const flagRunNextFrame = () => runNextFrame = true;
    const steps = stepsOrder.reduce((acc, key) => {
      acc[key] = createRenderStep(flagRunNextFrame);
      return acc;
    }, {});
    const { read, resolveKeyframes, update, preRender, render, postRender } = steps;
    const processBatch = () => {
      const timestamp = MotionGlobalConfig.useManualTiming ? state.timestamp : performance.now();
      runNextFrame = false;
      state.delta = useDefaultElapsed ? 1e3 / 60 : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1);
      state.timestamp = timestamp;
      state.isProcessing = true;
      read.process(state);
      resolveKeyframes.process(state);
      update.process(state);
      preRender.process(state);
      render.process(state);
      postRender.process(state);
      state.isProcessing = false;
      if (runNextFrame && allowKeepAlive) {
        useDefaultElapsed = false;
        scheduleNextBatch(processBatch);
      }
    };
    const wake = () => {
      runNextFrame = true;
      useDefaultElapsed = true;
      if (!state.isProcessing) {
        scheduleNextBatch(processBatch);
      }
    };
    const schedule = stepsOrder.reduce((acc, key) => {
      const step = steps[key];
      acc[key] = (process2, keepAlive = false, immediate = false) => {
        if (!runNextFrame)
          wake();
        return step.schedule(process2, keepAlive, immediate);
      };
      return acc;
    }, {});
    const cancel = (process2) => {
      for (let i = 0; i < stepsOrder.length; i++) {
        steps[stepsOrder[i]].cancel(process2);
      }
    };
    return { schedule, cancel, state, steps };
  }

  // ../../../node_modules/framer-motion/dist/es/frameloop/frame.mjs
  var { schedule: frame, cancel: cancelFrame, state: frameData, steps: frameSteps } = createRenderBatcher(typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop, true);

  // ../../../node_modules/framer-motion/dist/es/context/LazyContext.mjs
  var LazyContext = createContext({ strict: false });

  // ../../../node_modules/framer-motion/dist/es/motion/features/definitions.mjs
  var featureProps = {
    animation: [
      "animate",
      "variants",
      "whileHover",
      "whileTap",
      "exit",
      "whileInView",
      "whileFocus",
      "whileDrag"
    ],
    exit: ["exit"],
    drag: ["drag", "dragControls"],
    focus: ["whileFocus"],
    hover: ["whileHover", "onHoverStart", "onHoverEnd"],
    tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
    pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
    inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
    layout: ["layout", "layoutId"]
  };
  var featureDefinitions = {};
  for (const key in featureProps) {
    featureDefinitions[key] = {
      isEnabled: (props) => featureProps[key].some((name) => !!props[name])
    };
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/load-features.mjs
  function loadFeatures(features) {
    for (const key in features) {
      featureDefinitions[key] = {
        ...featureDefinitions[key],
        ...features[key]
      };
    }
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/valid-prop.mjs
  var validMotionProps = /* @__PURE__ */ new Set([
    "animate",
    "exit",
    "variants",
    "initial",
    "style",
    "values",
    "variants",
    "transition",
    "transformTemplate",
    "custom",
    "inherit",
    "onBeforeLayoutMeasure",
    "onAnimationStart",
    "onAnimationComplete",
    "onUpdate",
    "onDragStart",
    "onDrag",
    "onDragEnd",
    "onMeasureDragConstraints",
    "onDirectionLock",
    "onDragTransitionEnd",
    "_dragX",
    "_dragY",
    "onHoverStart",
    "onHoverEnd",
    "onViewportEnter",
    "onViewportLeave",
    "globalTapTarget",
    "ignoreStrict",
    "viewport"
  ]);
  function isValidMotionProp(key) {
    return key.startsWith("while") || key.startsWith("drag") && key !== "draggable" || key.startsWith("layout") || key.startsWith("onTap") || key.startsWith("onPan") || key.startsWith("onLayout") || validMotionProps.has(key);
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/filter-props.mjs
  var shouldForward = (key) => !isValidMotionProp(key);
  function loadExternalIsValidProp(isValidProp) {
    if (!isValidProp)
      return;
    shouldForward = (key) => key.startsWith("on") ? !isValidMotionProp(key) : isValidProp(key);
  }
  try {
    loadExternalIsValidProp(__require("@emotion/is-prop-valid").default);
  } catch (_a) {
  }
  function filterProps(props, isDom, forwardMotionProps) {
    const filteredProps = {};
    for (const key in props) {
      if (key === "values" && typeof props.values === "object")
        continue;
      if (shouldForward(key) || forwardMotionProps === true && isValidMotionProp(key) || !isDom && !isValidMotionProp(key) || // If trying to use native HTML drag events, forward drag listeners
      props["draggable"] && key.startsWith("onDrag")) {
        filteredProps[key] = props[key];
      }
    }
    return filteredProps;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/warn-once.mjs
  var warned = /* @__PURE__ */ new Set();
  function warnOnce(condition, message, element) {
    if (condition || warned.has(message))
      return;
    console.warn(message);
    if (element)
      console.warn(element);
    warned.add(message);
  }

  // ../../../node_modules/framer-motion/dist/es/render/components/create-proxy.mjs
  function createDOMMotionComponentProxy(componentFactory) {
    if (typeof Proxy === "undefined") {
      return componentFactory;
    }
    const componentCache = /* @__PURE__ */ new Map();
    const deprecatedFactoryFunction = (...args) => {
      if (true) {
        warnOnce(false, "motion() is deprecated. Use motion.create() instead.");
      }
      return componentFactory(...args);
    };
    return new Proxy(deprecatedFactoryFunction, {
      /**
       * Called when `motion` is referenced with a prop: `motion.div`, `motion.input` etc.
       * The prop name is passed through as `key` and we can use that to generate a `motion`
       * DOM component with that name.
       */
      get: (_target, key) => {
        if (key === "create")
          return componentFactory;
        if (!componentCache.has(key)) {
          componentCache.set(key, componentFactory(key));
        }
        return componentCache.get(key);
      }
    });
  }

  // ../../../node_modules/framer-motion/dist/es/context/MotionContext/index.mjs
  var MotionContext = createContext({});

  // ../../../node_modules/framer-motion/dist/es/render/utils/is-variant-label.mjs
  function isVariantLabel(v) {
    return typeof v === "string" || Array.isArray(v);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-animation-controls.mjs
  function isAnimationControls(v) {
    return v !== null && typeof v === "object" && typeof v.start === "function";
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/variant-props.mjs
  var variantPriorityOrder = [
    "animate",
    "whileInView",
    "whileFocus",
    "whileHover",
    "whileTap",
    "whileDrag",
    "exit"
  ];
  var variantProps = ["initial", ...variantPriorityOrder];

  // ../../../node_modules/framer-motion/dist/es/render/utils/is-controlling-variants.mjs
  function isControllingVariants(props) {
    return isAnimationControls(props.animate) || variantProps.some((name) => isVariantLabel(props[name]));
  }
  function isVariantNode(props) {
    return Boolean(isControllingVariants(props) || props.variants);
  }

  // ../../../node_modules/framer-motion/dist/es/context/MotionContext/utils.mjs
  function getCurrentTreeVariants(props, context) {
    if (isControllingVariants(props)) {
      const { initial, animate } = props;
      return {
        initial: initial === false || isVariantLabel(initial) ? initial : void 0,
        animate: isVariantLabel(animate) ? animate : void 0
      };
    }
    return props.inherit !== false ? context : {};
  }

  // ../../../node_modules/framer-motion/dist/es/context/MotionContext/create.mjs
  function useCreateMotionContext(props) {
    const { initial, animate } = getCurrentTreeVariants(props, useContext(MotionContext));
    return useMemo(() => ({ initial, animate }), [variantLabelsAsDependency(initial), variantLabelsAsDependency(animate)]);
  }
  function variantLabelsAsDependency(prop) {
    return Array.isArray(prop) ? prop.join(" ") : prop;
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/symbol.mjs
  var motionComponentSymbol = /* @__PURE__ */ Symbol.for("motionComponentSymbol");

  // ../../../node_modules/framer-motion/dist/es/utils/is-ref-object.mjs
  function isRefObject(ref) {
    return ref && typeof ref === "object" && Object.prototype.hasOwnProperty.call(ref, "current");
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs
  function useMotionRef(visualState, visualElement, externalRef) {
    return useCallback(
      (instance) => {
        if (instance) {
          visualState.onMount && visualState.onMount(instance);
        }
        if (visualElement) {
          if (instance) {
            visualElement.mount(instance);
          } else {
            visualElement.unmount();
          }
        }
        if (externalRef) {
          if (typeof externalRef === "function") {
            externalRef(instance);
          } else if (isRefObject(externalRef)) {
            externalRef.current = instance;
          }
        }
      },
      /**
       * Only pass a new ref callback to React if we've received a visual element
       * factory. Otherwise we'll be mounting/remounting every time externalRef
       * or other dependencies change.
       */
      [visualElement]
    );
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/camel-to-dash.mjs
  var camelToDash = (str) => str.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase();

  // ../../../node_modules/framer-motion/dist/es/animation/optimized-appear/data-id.mjs
  var optimizedAppearDataId = "framerAppearId";
  var optimizedAppearDataAttribute = "data-" + camelToDash(optimizedAppearDataId);

  // ../../../node_modules/framer-motion/dist/es/frameloop/microtask.mjs
  var { schedule: microtask, cancel: cancelMicrotask } = createRenderBatcher(queueMicrotask, false);

  // ../../../node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs
  var SwitchLayoutGroupContext = createContext({});

  // ../../../node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs
  function useVisualElement(Component2, visualState, props, createVisualElement, ProjectionNodeConstructor) {
    var _a, _b;
    const { visualElement: parent } = useContext(MotionContext);
    const lazyContext = useContext(LazyContext);
    const presenceContext = useContext(PresenceContext);
    const reducedMotionConfig = useContext(MotionConfigContext).reducedMotion;
    const visualElementRef = useRef(null);
    createVisualElement = createVisualElement || lazyContext.renderer;
    if (!visualElementRef.current && createVisualElement) {
      visualElementRef.current = createVisualElement(Component2, {
        visualState,
        parent,
        props,
        presenceContext,
        blockInitialAnimation: presenceContext ? presenceContext.initial === false : false,
        reducedMotionConfig
      });
    }
    const visualElement = visualElementRef.current;
    const initialLayoutGroupConfig = useContext(SwitchLayoutGroupContext);
    if (visualElement && !visualElement.projection && ProjectionNodeConstructor && (visualElement.type === "html" || visualElement.type === "svg")) {
      createProjectionNode(visualElementRef.current, props, ProjectionNodeConstructor, initialLayoutGroupConfig);
    }
    const isMounted = useRef(false);
    useInsertionEffect(() => {
      if (visualElement && isMounted.current) {
        visualElement.update(props, presenceContext);
      }
    });
    const optimisedAppearId = props[optimizedAppearDataAttribute];
    const wantsHandoff = useRef(Boolean(optimisedAppearId) && !((_a = window.MotionHandoffIsComplete) === null || _a === void 0 ? void 0 : _a.call(window, optimisedAppearId)) && ((_b = window.MotionHasOptimisedAnimation) === null || _b === void 0 ? void 0 : _b.call(window, optimisedAppearId)));
    useIsomorphicLayoutEffect(() => {
      if (!visualElement)
        return;
      isMounted.current = true;
      window.MotionIsMounted = true;
      visualElement.updateFeatures();
      microtask.render(visualElement.render);
      if (wantsHandoff.current && visualElement.animationState) {
        visualElement.animationState.animateChanges();
      }
    });
    useEffect(() => {
      if (!visualElement)
        return;
      if (!wantsHandoff.current && visualElement.animationState) {
        visualElement.animationState.animateChanges();
      }
      if (wantsHandoff.current) {
        queueMicrotask(() => {
          var _a2;
          (_a2 = window.MotionHandoffMarkAsComplete) === null || _a2 === void 0 ? void 0 : _a2.call(window, optimisedAppearId);
        });
        wantsHandoff.current = false;
      }
    });
    return visualElement;
  }
  function createProjectionNode(visualElement, props, ProjectionNodeConstructor, initialPromotionConfig) {
    const { layoutId, layout: layout2, drag: drag2, dragConstraints, layoutScroll, layoutRoot } = props;
    visualElement.projection = new ProjectionNodeConstructor(visualElement.latestValues, props["data-framer-portal-id"] ? void 0 : getClosestProjectingNode(visualElement.parent));
    visualElement.projection.setOptions({
      layoutId,
      layout: layout2,
      alwaysMeasureLayout: Boolean(drag2) || dragConstraints && isRefObject(dragConstraints),
      visualElement,
      /**
       * TODO: Update options in an effect. This could be tricky as it'll be too late
       * to update by the time layout animations run.
       * We also need to fix this safeToRemove by linking it up to the one returned by usePresence,
       * ensuring it gets called if there's no potential layout animations.
       *
       */
      animationType: typeof layout2 === "string" ? layout2 : "both",
      initialPromotionConfig,
      layoutScroll,
      layoutRoot
    });
  }
  function getClosestProjectingNode(visualElement) {
    if (!visualElement)
      return void 0;
    return visualElement.options.allowProjection !== false ? visualElement.projection : getClosestProjectingNode(visualElement.parent);
  }

  // ../../../node_modules/framer-motion/dist/es/motion/index.mjs
  function createRendererMotionComponent({ preloadedFeatures, createVisualElement, useRender, useVisualState, Component: Component2 }) {
    var _a, _b;
    preloadedFeatures && loadFeatures(preloadedFeatures);
    function MotionComponent(props, externalRef) {
      let MeasureLayout2;
      const configAndProps = {
        ...useContext(MotionConfigContext),
        ...props,
        layoutId: useLayoutId(props)
      };
      const { isStatic } = configAndProps;
      const context = useCreateMotionContext(props);
      const visualState = useVisualState(props, isStatic);
      if (!isStatic && isBrowser) {
        useStrictMode(configAndProps, preloadedFeatures);
        const layoutProjection = getProjectionFunctionality(configAndProps);
        MeasureLayout2 = layoutProjection.MeasureLayout;
        context.visualElement = useVisualElement(Component2, visualState, configAndProps, createVisualElement, layoutProjection.ProjectionNode);
      }
      return jsxs(MotionContext.Provider, { value: context, children: [MeasureLayout2 && context.visualElement ? jsx(MeasureLayout2, { visualElement: context.visualElement, ...configAndProps }) : null, useRender(Component2, props, useMotionRef(visualState, context.visualElement, externalRef), visualState, isStatic, context.visualElement)] });
    }
    MotionComponent.displayName = `motion.${typeof Component2 === "string" ? Component2 : `create(${(_b = (_a = Component2.displayName) !== null && _a !== void 0 ? _a : Component2.name) !== null && _b !== void 0 ? _b : ""})`}`;
    const ForwardRefMotionComponent = forwardRef(MotionComponent);
    ForwardRefMotionComponent[motionComponentSymbol] = Component2;
    return ForwardRefMotionComponent;
  }
  function useLayoutId({ layoutId }) {
    const layoutGroupId = useContext(LayoutGroupContext).id;
    return layoutGroupId && layoutId !== void 0 ? layoutGroupId + "-" + layoutId : layoutId;
  }
  function useStrictMode(configAndProps, preloadedFeatures) {
    const isStrict = useContext(LazyContext).strict;
    if (preloadedFeatures && isStrict) {
      const strictMessage = "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead.";
      configAndProps.ignoreStrict ? warning(false, strictMessage) : invariant(false, strictMessage);
    }
  }
  function getProjectionFunctionality(props) {
    const { drag: drag2, layout: layout2 } = featureDefinitions;
    if (!drag2 && !layout2)
      return {};
    const combined = { ...drag2, ...layout2 };
    return {
      MeasureLayout: (drag2 === null || drag2 === void 0 ? void 0 : drag2.isEnabled(props)) || (layout2 === null || layout2 === void 0 ? void 0 : layout2.isEnabled(props)) ? combined.MeasureLayout : void 0,
      ProjectionNode: combined.ProjectionNode
    };
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/lowercase-elements.mjs
  var lowercaseSVGElements = [
    "animate",
    "circle",
    "defs",
    "desc",
    "ellipse",
    "g",
    "image",
    "line",
    "filter",
    "marker",
    "mask",
    "metadata",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "rect",
    "stop",
    "switch",
    "symbol",
    "svg",
    "text",
    "tspan",
    "use",
    "view"
  ];

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/is-svg-component.mjs
  function isSVGComponent(Component2) {
    if (
      /**
       * If it's not a string, it's a custom React component. Currently we only support
       * HTML custom React components.
       */
      typeof Component2 !== "string" || /**
       * If it contains a dash, the element is a custom HTML webcomponent.
       */
      Component2.includes("-")
    ) {
      return false;
    } else if (
      /**
       * If it's in our list of lowercase SVG tags, it's an SVG component
       */
      lowercaseSVGElements.indexOf(Component2) > -1 || /**
       * If it contains a capital letter, it's an SVG component
       */
      /[A-Z]/u.test(Component2)
    ) {
      return true;
    }
    return false;
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/resolve-variants.mjs
  function getValueState(visualElement) {
    const state = [{}, {}];
    visualElement === null || visualElement === void 0 ? void 0 : visualElement.values.forEach((value, key) => {
      state[0][key] = value.get();
      state[1][key] = value.getVelocity();
    });
    return state;
  }
  function resolveVariantFromProps(props, definition, custom, visualElement) {
    if (typeof definition === "function") {
      const [current, velocity] = getValueState(visualElement);
      definition = definition(custom !== void 0 ? custom : props.custom, current, velocity);
    }
    if (typeof definition === "string") {
      definition = props.variants && props.variants[definition];
    }
    if (typeof definition === "function") {
      const [current, velocity] = getValueState(visualElement);
      definition = definition(custom !== void 0 ? custom : props.custom, current, velocity);
    }
    return definition;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-keyframes-target.mjs
  var isKeyframesTarget = (v) => {
    return Array.isArray(v);
  };

  // ../../../node_modules/framer-motion/dist/es/utils/resolve-value.mjs
  var isCustomValue = (v) => {
    return Boolean(v && typeof v === "object" && v.mix && v.toValue);
  };
  var resolveFinalValueInKeyframes = (v) => {
    return isKeyframesTarget(v) ? v[v.length - 1] || 0 : v;
  };

  // ../../../node_modules/framer-motion/dist/es/value/utils/is-motion-value.mjs
  var isMotionValue = (value) => Boolean(value && value.getVelocity);

  // ../../../node_modules/framer-motion/dist/es/value/utils/resolve-motion-value.mjs
  function resolveMotionValue(value) {
    const unwrappedValue = isMotionValue(value) ? value.get() : value;
    return isCustomValue(unwrappedValue) ? unwrappedValue.toValue() : unwrappedValue;
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs
  function makeState({ scrapeMotionValuesFromProps: scrapeMotionValuesFromProps3, createRenderState, onUpdate }, props, context, presenceContext) {
    const state = {
      latestValues: makeLatestValues(props, context, presenceContext, scrapeMotionValuesFromProps3),
      renderState: createRenderState()
    };
    if (onUpdate) {
      state.onMount = (instance) => onUpdate({ props, current: instance, ...state });
      state.onUpdate = (visualElement) => onUpdate(visualElement);
    }
    return state;
  }
  var makeUseVisualState = (config) => (props, isStatic) => {
    const context = useContext(MotionContext);
    const presenceContext = useContext(PresenceContext);
    const make = () => makeState(config, props, context, presenceContext);
    return isStatic ? make() : useConstant(make);
  };
  function makeLatestValues(props, context, presenceContext, scrapeMotionValues) {
    const values = {};
    const motionValues = scrapeMotionValues(props, {});
    for (const key in motionValues) {
      values[key] = resolveMotionValue(motionValues[key]);
    }
    let { initial, animate } = props;
    const isControllingVariants$1 = isControllingVariants(props);
    const isVariantNode$1 = isVariantNode(props);
    if (context && isVariantNode$1 && !isControllingVariants$1 && props.inherit !== false) {
      if (initial === void 0)
        initial = context.initial;
      if (animate === void 0)
        animate = context.animate;
    }
    let isInitialAnimationBlocked = presenceContext ? presenceContext.initial === false : false;
    isInitialAnimationBlocked = isInitialAnimationBlocked || initial === false;
    const variantToSet = isInitialAnimationBlocked ? animate : initial;
    if (variantToSet && typeof variantToSet !== "boolean" && !isAnimationControls(variantToSet)) {
      const list = Array.isArray(variantToSet) ? variantToSet : [variantToSet];
      for (let i = 0; i < list.length; i++) {
        const resolved = resolveVariantFromProps(props, list[i]);
        if (resolved) {
          const { transitionEnd, transition, ...target } = resolved;
          for (const key in target) {
            let valueTarget = target[key];
            if (Array.isArray(valueTarget)) {
              const index = isInitialAnimationBlocked ? valueTarget.length - 1 : 0;
              valueTarget = valueTarget[index];
            }
            if (valueTarget !== null) {
              values[key] = valueTarget;
            }
          }
          for (const key in transitionEnd) {
            values[key] = transitionEnd[key];
          }
        }
      }
    }
    return values;
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/keys-transform.mjs
  var transformPropOrder = [
    "transformPerspective",
    "x",
    "y",
    "z",
    "translateX",
    "translateY",
    "translateZ",
    "scale",
    "scaleX",
    "scaleY",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "skew",
    "skewX",
    "skewY"
  ];
  var transformProps = new Set(transformPropOrder);

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/is-css-variable.mjs
  var checkStringStartsWith = (token) => (key) => typeof key === "string" && key.startsWith(token);
  var isCSSVariableName = /* @__PURE__ */ checkStringStartsWith("--");
  var startsAsVariableToken = /* @__PURE__ */ checkStringStartsWith("var(--");
  var isCSSVariableToken = (value) => {
    const startsWithToken = startsAsVariableToken(value);
    if (!startsWithToken)
      return false;
    return singleCssVariableRegex.test(value.split("/*")[0].trim());
  };
  var singleCssVariableRegex = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/get-as-type.mjs
  var getValueAsType = (value, type) => {
    return type && typeof value === "number" ? type.transform(value) : value;
  };

  // ../../../node_modules/framer-motion/dist/es/utils/clamp.mjs
  var clamp = (min, max, v) => {
    if (v > max)
      return max;
    if (v < min)
      return min;
    return v;
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/numbers/index.mjs
  var number = {
    test: (v) => typeof v === "number",
    parse: parseFloat,
    transform: (v) => v
  };
  var alpha = {
    ...number,
    transform: (v) => clamp(0, 1, v)
  };
  var scale = {
    ...number,
    default: 1
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/numbers/units.mjs
  var createUnitType = (unit) => ({
    test: (v) => typeof v === "string" && v.endsWith(unit) && v.split(" ").length === 1,
    parse: parseFloat,
    transform: (v) => `${v}${unit}`
  });
  var degrees = /* @__PURE__ */ createUnitType("deg");
  var percent = /* @__PURE__ */ createUnitType("%");
  var px = /* @__PURE__ */ createUnitType("px");
  var vh = /* @__PURE__ */ createUnitType("vh");
  var vw = /* @__PURE__ */ createUnitType("vw");
  var progressPercentage = {
    ...percent,
    parse: (v) => percent.parse(v) / 100,
    transform: (v) => percent.transform(v * 100)
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/number-browser.mjs
  var browserNumberValueTypes = {
    // Border props
    borderWidth: px,
    borderTopWidth: px,
    borderRightWidth: px,
    borderBottomWidth: px,
    borderLeftWidth: px,
    borderRadius: px,
    radius: px,
    borderTopLeftRadius: px,
    borderTopRightRadius: px,
    borderBottomRightRadius: px,
    borderBottomLeftRadius: px,
    // Positioning props
    width: px,
    maxWidth: px,
    height: px,
    maxHeight: px,
    top: px,
    right: px,
    bottom: px,
    left: px,
    // Spacing props
    padding: px,
    paddingTop: px,
    paddingRight: px,
    paddingBottom: px,
    paddingLeft: px,
    margin: px,
    marginTop: px,
    marginRight: px,
    marginBottom: px,
    marginLeft: px,
    // Misc
    backgroundPositionX: px,
    backgroundPositionY: px
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/transform.mjs
  var transformValueTypes = {
    rotate: degrees,
    rotateX: degrees,
    rotateY: degrees,
    rotateZ: degrees,
    scale,
    scaleX: scale,
    scaleY: scale,
    scaleZ: scale,
    skew: degrees,
    skewX: degrees,
    skewY: degrees,
    distance: px,
    translateX: px,
    translateY: px,
    translateZ: px,
    x: px,
    y: px,
    z: px,
    perspective: px,
    transformPerspective: px,
    opacity: alpha,
    originX: progressPercentage,
    originY: progressPercentage,
    originZ: px
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/type-int.mjs
  var int = {
    ...number,
    transform: Math.round
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/number.mjs
  var numberValueTypes = {
    ...browserNumberValueTypes,
    ...transformValueTypes,
    zIndex: int,
    size: px,
    // SVG
    fillOpacity: alpha,
    strokeOpacity: alpha,
    numOctaves: int
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/build-transform.mjs
  var translateAlias = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective"
  };
  var numTransforms = transformPropOrder.length;
  function buildTransform(latestValues, transform, transformTemplate) {
    let transformString = "";
    let transformIsDefault = true;
    for (let i = 0; i < numTransforms; i++) {
      const key = transformPropOrder[i];
      const value = latestValues[key];
      if (value === void 0)
        continue;
      let valueIsDefault = true;
      if (typeof value === "number") {
        valueIsDefault = value === (key.startsWith("scale") ? 1 : 0);
      } else {
        valueIsDefault = parseFloat(value) === 0;
      }
      if (!valueIsDefault || transformTemplate) {
        const valueAsType = getValueAsType(value, numberValueTypes[key]);
        if (!valueIsDefault) {
          transformIsDefault = false;
          const transformName = translateAlias[key] || key;
          transformString += `${transformName}(${valueAsType}) `;
        }
        if (transformTemplate) {
          transform[key] = valueAsType;
        }
      }
    }
    transformString = transformString.trim();
    if (transformTemplate) {
      transformString = transformTemplate(transform, transformIsDefault ? "" : transformString);
    } else if (transformIsDefault) {
      transformString = "none";
    }
    return transformString;
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/build-styles.mjs
  function buildHTMLStyles(state, latestValues, transformTemplate) {
    const { style, vars, transformOrigin } = state;
    let hasTransform2 = false;
    let hasTransformOrigin = false;
    for (const key in latestValues) {
      const value = latestValues[key];
      if (transformProps.has(key)) {
        hasTransform2 = true;
        continue;
      } else if (isCSSVariableName(key)) {
        vars[key] = value;
        continue;
      } else {
        const valueAsType = getValueAsType(value, numberValueTypes[key]);
        if (key.startsWith("origin")) {
          hasTransformOrigin = true;
          transformOrigin[key] = valueAsType;
        } else {
          style[key] = valueAsType;
        }
      }
    }
    if (!latestValues.transform) {
      if (hasTransform2 || transformTemplate) {
        style.transform = buildTransform(latestValues, state.transform, transformTemplate);
      } else if (style.transform) {
        style.transform = "none";
      }
    }
    if (hasTransformOrigin) {
      const { originX = "50%", originY = "50%", originZ = 0 } = transformOrigin;
      style.transformOrigin = `${originX} ${originY} ${originZ}`;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/path.mjs
  var dashKeys = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray"
  };
  var camelKeys = {
    offset: "strokeDashoffset",
    array: "strokeDasharray"
  };
  function buildSVGPath(attrs, length, spacing3 = 1, offset = 0, useDashCase = true) {
    attrs.pathLength = 1;
    const keys = useDashCase ? dashKeys : camelKeys;
    attrs[keys.offset] = px.transform(-offset);
    const pathLength = px.transform(length);
    const pathSpacing = px.transform(spacing3);
    attrs[keys.array] = `${pathLength} ${pathSpacing}`;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/transform-origin.mjs
  function calcOrigin(origin, offset, size) {
    return typeof origin === "string" ? origin : px.transform(offset + size * origin);
  }
  function calcSVGTransformOrigin(dimensions, originX, originY) {
    const pxOriginX = calcOrigin(originX, dimensions.x, dimensions.width);
    const pxOriginY = calcOrigin(originY, dimensions.y, dimensions.height);
    return `${pxOriginX} ${pxOriginY}`;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/build-attrs.mjs
  function buildSVGAttrs(state, {
    attrX,
    attrY,
    attrScale,
    originX,
    originY,
    pathLength,
    pathSpacing = 1,
    pathOffset = 0,
    // This is object creation, which we try to avoid per-frame.
    ...latest
  }, isSVGTag2, transformTemplate) {
    buildHTMLStyles(state, latest, transformTemplate);
    if (isSVGTag2) {
      if (state.style.viewBox) {
        state.attrs.viewBox = state.style.viewBox;
      }
      return;
    }
    state.attrs = state.style;
    state.style = {};
    const { attrs, style, dimensions } = state;
    if (attrs.transform) {
      if (dimensions)
        style.transform = attrs.transform;
      delete attrs.transform;
    }
    if (dimensions && (originX !== void 0 || originY !== void 0 || style.transform)) {
      style.transformOrigin = calcSVGTransformOrigin(dimensions, originX !== void 0 ? originX : 0.5, originY !== void 0 ? originY : 0.5);
    }
    if (attrX !== void 0)
      attrs.x = attrX;
    if (attrY !== void 0)
      attrs.y = attrY;
    if (attrScale !== void 0)
      attrs.scale = attrScale;
    if (pathLength !== void 0) {
      buildSVGPath(attrs, pathLength, pathSpacing, pathOffset, false);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/create-render-state.mjs
  var createHtmlRenderState = () => ({
    style: {},
    transform: {},
    transformOrigin: {},
    vars: {}
  });

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/create-render-state.mjs
  var createSvgRenderState = () => ({
    ...createHtmlRenderState(),
    attrs: {}
  });

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/is-svg-tag.mjs
  var isSVGTag = (tag) => typeof tag === "string" && tag.toLowerCase() === "svg";

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/render.mjs
  function renderHTML(element, { style, vars }, styleProp, projection) {
    Object.assign(element.style, style, projection && projection.getProjectionStyles(styleProp));
    for (const key in vars) {
      element.style.setProperty(key, vars[key]);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/camel-case-attrs.mjs
  var camelCaseAttributes = /* @__PURE__ */ new Set([
    "baseFrequency",
    "diffuseConstant",
    "kernelMatrix",
    "kernelUnitLength",
    "keySplines",
    "keyTimes",
    "limitingConeAngle",
    "markerHeight",
    "markerWidth",
    "numOctaves",
    "targetX",
    "targetY",
    "surfaceScale",
    "specularConstant",
    "specularExponent",
    "stdDeviation",
    "tableValues",
    "viewBox",
    "gradientTransform",
    "pathLength",
    "startOffset",
    "textLength",
    "lengthAdjust"
  ]);

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/render.mjs
  function renderSVG(element, renderState, _styleProp, projection) {
    renderHTML(element, renderState, void 0, projection);
    for (const key in renderState.attrs) {
      element.setAttribute(!camelCaseAttributes.has(key) ? camelToDash(key) : key, renderState.attrs[key]);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/projection/styles/scale-correction.mjs
  var scaleCorrectors = {};
  function addScaleCorrector(correctors) {
    Object.assign(scaleCorrectors, correctors);
  }

  // ../../../node_modules/framer-motion/dist/es/motion/utils/is-forced-motion-value.mjs
  function isForcedMotionValue(key, { layout: layout2, layoutId }) {
    return transformProps.has(key) || key.startsWith("origin") || (layout2 || layoutId !== void 0) && (!!scaleCorrectors[key] || key === "opacity");
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/scrape-motion-values.mjs
  function scrapeMotionValuesFromProps(props, prevProps, visualElement) {
    var _a;
    const { style } = props;
    const newValues = {};
    for (const key in style) {
      if (isMotionValue(style[key]) || prevProps.style && isMotionValue(prevProps.style[key]) || isForcedMotionValue(key, props) || ((_a = visualElement === null || visualElement === void 0 ? void 0 : visualElement.getValue(key)) === null || _a === void 0 ? void 0 : _a.liveStyle) !== void 0) {
        newValues[key] = style[key];
      }
    }
    return newValues;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/utils/scrape-motion-values.mjs
  function scrapeMotionValuesFromProps2(props, prevProps, visualElement) {
    const newValues = scrapeMotionValuesFromProps(props, prevProps, visualElement);
    for (const key in props) {
      if (isMotionValue(props[key]) || isMotionValue(prevProps[key])) {
        const targetKey = transformPropOrder.indexOf(key) !== -1 ? "attr" + key.charAt(0).toUpperCase() + key.substring(1) : key;
        newValues[targetKey] = props[key];
      }
    }
    return newValues;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/config-motion.mjs
  function updateSVGDimensions(instance, renderState) {
    try {
      renderState.dimensions = typeof instance.getBBox === "function" ? instance.getBBox() : instance.getBoundingClientRect();
    } catch (e) {
      renderState.dimensions = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };
    }
  }
  var layoutProps = ["x", "y", "width", "height", "cx", "cy", "r"];
  var svgMotionConfig = {
    useVisualState: makeUseVisualState({
      scrapeMotionValuesFromProps: scrapeMotionValuesFromProps2,
      createRenderState: createSvgRenderState,
      onUpdate: ({ props, prevProps, current, renderState, latestValues }) => {
        if (!current)
          return;
        let hasTransform2 = !!props.drag;
        if (!hasTransform2) {
          for (const key in latestValues) {
            if (transformProps.has(key)) {
              hasTransform2 = true;
              break;
            }
          }
        }
        if (!hasTransform2)
          return;
        let needsMeasure = !prevProps;
        if (prevProps) {
          for (let i = 0; i < layoutProps.length; i++) {
            const key = layoutProps[i];
            if (props[key] !== prevProps[key]) {
              needsMeasure = true;
            }
          }
        }
        if (!needsMeasure)
          return;
        frame.read(() => {
          updateSVGDimensions(current, renderState);
          frame.render(() => {
            buildSVGAttrs(renderState, latestValues, isSVGTag(current.tagName), props.transformTemplate);
            renderSVG(current, renderState);
          });
        });
      }
    })
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/config-motion.mjs
  var htmlMotionConfig = {
    useVisualState: makeUseVisualState({
      scrapeMotionValuesFromProps,
      createRenderState: createHtmlRenderState
    })
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/use-props.mjs
  function copyRawValuesOnly(target, source, props) {
    for (const key in source) {
      if (!isMotionValue(source[key]) && !isForcedMotionValue(key, props)) {
        target[key] = source[key];
      }
    }
  }
  function useInitialMotionValues({ transformTemplate }, visualState) {
    return useMemo(() => {
      const state = createHtmlRenderState();
      buildHTMLStyles(state, visualState, transformTemplate);
      return Object.assign({}, state.vars, state.style);
    }, [visualState]);
  }
  function useStyle(props, visualState) {
    const styleProp = props.style || {};
    const style = {};
    copyRawValuesOnly(style, styleProp, props);
    Object.assign(style, useInitialMotionValues(props, visualState));
    return style;
  }
  function useHTMLProps(props, visualState) {
    const htmlProps = {};
    const style = useStyle(props, visualState);
    if (props.drag && props.dragListener !== false) {
      htmlProps.draggable = false;
      style.userSelect = style.WebkitUserSelect = style.WebkitTouchCallout = "none";
      style.touchAction = props.drag === true ? "none" : `pan-${props.drag === "x" ? "y" : "x"}`;
    }
    if (props.tabIndex === void 0 && (props.onTap || props.onTapStart || props.whileTap)) {
      htmlProps.tabIndex = 0;
    }
    htmlProps.style = style;
    return htmlProps;
  }

  // ../../../node_modules/framer-motion/dist/es/render/svg/use-props.mjs
  function useSVGProps(props, visualState, _isStatic, Component2) {
    const visualProps = useMemo(() => {
      const state = createSvgRenderState();
      buildSVGAttrs(state, visualState, isSVGTag(Component2), props.transformTemplate);
      return {
        ...state.attrs,
        style: { ...state.style }
      };
    }, [visualState]);
    if (props.style) {
      const rawStyles = {};
      copyRawValuesOnly(rawStyles, props.style, props);
      visualProps.style = { ...rawStyles, ...visualProps.style };
    }
    return visualProps;
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/use-render.mjs
  function createUseRender(forwardMotionProps = false) {
    const useRender = (Component2, props, ref, { latestValues }, isStatic) => {
      const useVisualProps = isSVGComponent(Component2) ? useSVGProps : useHTMLProps;
      const visualProps = useVisualProps(props, latestValues, isStatic, Component2);
      const filteredProps = filterProps(props, typeof Component2 === "string", forwardMotionProps);
      const elementProps = Component2 !== Fragment ? { ...filteredProps, ...visualProps, ref } : {};
      const { children } = props;
      const renderedChildren = useMemo(() => isMotionValue(children) ? children.get() : children, [children]);
      return createElement(Component2, {
        ...elementProps,
        children: renderedChildren
      });
    };
    return useRender;
  }

  // ../../../node_modules/framer-motion/dist/es/render/components/create-factory.mjs
  function createMotionComponentFactory(preloadedFeatures, createVisualElement) {
    return function createMotionComponent2(Component2, { forwardMotionProps } = { forwardMotionProps: false }) {
      const baseConfig = isSVGComponent(Component2) ? svgMotionConfig : htmlMotionConfig;
      const config = {
        ...baseConfig,
        preloadedFeatures,
        useRender: createUseRender(forwardMotionProps),
        createVisualElement,
        Component: Component2
      };
      return createRendererMotionComponent(config);
    };
  }

  // ../../../node_modules/framer-motion/dist/es/utils/shallow-compare.mjs
  function shallowCompare(next, prev) {
    if (!Array.isArray(prev))
      return false;
    const prevLength = prev.length;
    if (prevLength !== next.length)
      return false;
    for (let i = 0; i < prevLength; i++) {
      if (prev[i] !== next[i])
        return false;
    }
    return true;
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/resolve-dynamic-variants.mjs
  function resolveVariant(visualElement, definition, custom) {
    const props = visualElement.getProps();
    return resolveVariantFromProps(props, definition, custom !== void 0 ? custom : props.custom, visualElement);
  }

  // ../../../node_modules/motion-dom/dist/es/utils/supports/scroll-timeline.mjs
  var supportsScrollTimeline = memo2(() => window.ScrollTimeline !== void 0);

  // ../../../node_modules/motion-dom/dist/es/animation/controls/BaseGroup.mjs
  var BaseGroupPlaybackControls = class {
    constructor(animations2) {
      this.stop = () => this.runAll("stop");
      this.animations = animations2.filter(Boolean);
    }
    get finished() {
      return Promise.all(this.animations.map((animation3) => "finished" in animation3 ? animation3.finished : animation3));
    }
    /**
     * TODO: Filter out cancelled or stopped animations before returning
     */
    getAll(propName) {
      return this.animations[0][propName];
    }
    setAll(propName, newValue) {
      for (let i = 0; i < this.animations.length; i++) {
        this.animations[i][propName] = newValue;
      }
    }
    attachTimeline(timeline, fallback) {
      const subscriptions = this.animations.map((animation3) => {
        if (supportsScrollTimeline() && animation3.attachTimeline) {
          return animation3.attachTimeline(timeline);
        } else if (typeof fallback === "function") {
          return fallback(animation3);
        }
      });
      return () => {
        subscriptions.forEach((cancel, i) => {
          cancel && cancel();
          this.animations[i].stop();
        });
      };
    }
    get time() {
      return this.getAll("time");
    }
    set time(time2) {
      this.setAll("time", time2);
    }
    get speed() {
      return this.getAll("speed");
    }
    set speed(speed) {
      this.setAll("speed", speed);
    }
    get startTime() {
      return this.getAll("startTime");
    }
    get duration() {
      let max = 0;
      for (let i = 0; i < this.animations.length; i++) {
        max = Math.max(max, this.animations[i].duration);
      }
      return max;
    }
    runAll(methodName) {
      this.animations.forEach((controls) => controls[methodName]());
    }
    flatten() {
      this.runAll("flatten");
    }
    play() {
      this.runAll("play");
    }
    pause() {
      this.runAll("pause");
    }
    cancel() {
      this.runAll("cancel");
    }
    complete() {
      this.runAll("complete");
    }
  };

  // ../../../node_modules/motion-dom/dist/es/animation/controls/Group.mjs
  var GroupPlaybackControls = class extends BaseGroupPlaybackControls {
    then(onResolve, onReject) {
      return Promise.all(this.animations).then(onResolve).catch(onReject);
    }
  };

  // ../../../node_modules/motion-dom/dist/es/animation/utils/get-value-transition.mjs
  function getValueTransition(transition, key) {
    return transition ? transition[key] || transition["default"] || transition : void 0;
  }

  // ../../../node_modules/motion-dom/dist/es/animation/generators/utils/calc-duration.mjs
  var maxGeneratorDuration = 2e4;
  function calcGeneratorDuration(generator) {
    let duration = 0;
    const timeStep = 50;
    let state = generator.next(duration);
    while (!state.done && duration < maxGeneratorDuration) {
      duration += timeStep;
      state = generator.next(duration);
    }
    return duration >= maxGeneratorDuration ? Infinity : duration;
  }

  // ../../../node_modules/motion-dom/dist/es/animation/generators/utils/is-generator.mjs
  function isGenerator(type) {
    return typeof type === "function";
  }

  // ../../../node_modules/motion-dom/dist/es/animation/waapi/utils/attach-timeline.mjs
  function attachTimeline(animation3, timeline) {
    animation3.timeline = timeline;
    animation3.onfinish = null;
  }

  // ../../../node_modules/motion-dom/dist/es/utils/is-bezier-definition.mjs
  var isBezierDefinition = (easing) => Array.isArray(easing) && typeof easing[0] === "number";

  // ../../../node_modules/motion-dom/dist/es/utils/supports/flags.mjs
  var supportsFlags = {
    linearEasing: void 0
  };

  // ../../../node_modules/motion-dom/dist/es/utils/supports/memo.mjs
  function memoSupports(callback, supportsFlag) {
    const memoized = memo2(callback);
    return () => {
      var _a;
      return (_a = supportsFlags[supportsFlag]) !== null && _a !== void 0 ? _a : memoized();
    };
  }

  // ../../../node_modules/motion-dom/dist/es/utils/supports/linear-easing.mjs
  var supportsLinearEasing = /* @__PURE__ */ memoSupports(() => {
    try {
      document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
    } catch (e) {
      return false;
    }
    return true;
  }, "linearEasing");

  // ../../../node_modules/motion-dom/dist/es/animation/waapi/utils/linear.mjs
  var generateLinearEasing = (easing, duration, resolution = 10) => {
    let points = "";
    const numPoints = Math.max(Math.round(duration / resolution), 2);
    for (let i = 0; i < numPoints; i++) {
      points += easing(progress(0, numPoints - 1, i)) + ", ";
    }
    return `linear(${points.substring(0, points.length - 2)})`;
  };

  // ../../../node_modules/motion-dom/dist/es/animation/waapi/utils/easing.mjs
  function isWaapiSupportedEasing(easing) {
    return Boolean(typeof easing === "function" && supportsLinearEasing() || !easing || typeof easing === "string" && (easing in supportedWaapiEasing || supportsLinearEasing()) || isBezierDefinition(easing) || Array.isArray(easing) && easing.every(isWaapiSupportedEasing));
  }
  var cubicBezierAsString = ([a, b, c, d]) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
  var supportedWaapiEasing = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: /* @__PURE__ */ cubicBezierAsString([0, 0.65, 0.55, 1]),
    circOut: /* @__PURE__ */ cubicBezierAsString([0.55, 0, 1, 0.45]),
    backIn: /* @__PURE__ */ cubicBezierAsString([0.31, 0.01, 0.66, -0.59]),
    backOut: /* @__PURE__ */ cubicBezierAsString([0.33, 1.53, 0.69, 0.99])
  };
  function mapEasingToNativeEasing(easing, duration) {
    if (!easing) {
      return void 0;
    } else if (typeof easing === "function" && supportsLinearEasing()) {
      return generateLinearEasing(easing, duration);
    } else if (isBezierDefinition(easing)) {
      return cubicBezierAsString(easing);
    } else if (Array.isArray(easing)) {
      return easing.map((segmentEasing) => mapEasingToNativeEasing(segmentEasing, duration) || supportedWaapiEasing.easeOut);
    } else {
      return supportedWaapiEasing[easing];
    }
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/drag/state/is-active.mjs
  var isDragging = {
    x: false,
    y: false
  };
  function isDragActive() {
    return isDragging.x || isDragging.y;
  }

  // ../../../node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
  function resolveElements(elementOrSelector, scope, selectorCache) {
    var _a;
    if (elementOrSelector instanceof Element) {
      return [elementOrSelector];
    } else if (typeof elementOrSelector === "string") {
      let root = document;
      if (scope) {
        root = scope.current;
      }
      const elements = (_a = selectorCache === null || selectorCache === void 0 ? void 0 : selectorCache[elementOrSelector]) !== null && _a !== void 0 ? _a : root.querySelectorAll(elementOrSelector);
      return elements ? Array.from(elements) : [];
    }
    return Array.from(elementOrSelector);
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/utils/setup.mjs
  function setupGesture(elementOrSelector, options) {
    const elements = resolveElements(elementOrSelector);
    const gestureAbortController = new AbortController();
    const eventOptions = {
      passive: true,
      ...options,
      signal: gestureAbortController.signal
    };
    const cancel = () => gestureAbortController.abort();
    return [elements, eventOptions, cancel];
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/hover.mjs
  function filterEvents(callback) {
    return (event) => {
      if (event.pointerType === "touch" || isDragActive())
        return;
      callback(event);
    };
  }
  function hover(elementOrSelector, onHoverStart, options = {}) {
    const [elements, eventOptions, cancel] = setupGesture(elementOrSelector, options);
    const onPointerEnter = filterEvents((enterEvent) => {
      const { target } = enterEvent;
      const onHoverEnd = onHoverStart(enterEvent);
      if (typeof onHoverEnd !== "function" || !target)
        return;
      const onPointerLeave = filterEvents((leaveEvent) => {
        onHoverEnd(leaveEvent);
        target.removeEventListener("pointerleave", onPointerLeave);
      });
      target.addEventListener("pointerleave", onPointerLeave, eventOptions);
    });
    elements.forEach((element) => {
      element.addEventListener("pointerenter", onPointerEnter, eventOptions);
    });
    return cancel;
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/utils/is-node-or-child.mjs
  var isNodeOrChild = (parent, child) => {
    if (!child) {
      return false;
    } else if (parent === child) {
      return true;
    } else {
      return isNodeOrChild(parent, child.parentElement);
    }
  };

  // ../../../node_modules/motion-dom/dist/es/gestures/utils/is-primary-pointer.mjs
  var isPrimaryPointer = (event) => {
    if (event.pointerType === "mouse") {
      return typeof event.button !== "number" || event.button <= 0;
    } else {
      return event.isPrimary !== false;
    }
  };

  // ../../../node_modules/motion-dom/dist/es/gestures/press/utils/is-keyboard-accessible.mjs
  var focusableElements = /* @__PURE__ */ new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A"
  ]);
  function isElementKeyboardAccessible(element) {
    return focusableElements.has(element.tagName) || element.tabIndex !== -1;
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/press/utils/state.mjs
  var isPressing = /* @__PURE__ */ new WeakSet();

  // ../../../node_modules/motion-dom/dist/es/gestures/press/utils/keyboard.mjs
  function filterEvents2(callback) {
    return (event) => {
      if (event.key !== "Enter")
        return;
      callback(event);
    };
  }
  function firePointerEvent(target, type) {
    target.dispatchEvent(new PointerEvent("pointer" + type, { isPrimary: true, bubbles: true }));
  }
  var enableKeyboardPress = (focusEvent, eventOptions) => {
    const element = focusEvent.currentTarget;
    if (!element)
      return;
    const handleKeydown = filterEvents2(() => {
      if (isPressing.has(element))
        return;
      firePointerEvent(element, "down");
      const handleKeyup = filterEvents2(() => {
        firePointerEvent(element, "up");
      });
      const handleBlur = () => firePointerEvent(element, "cancel");
      element.addEventListener("keyup", handleKeyup, eventOptions);
      element.addEventListener("blur", handleBlur, eventOptions);
    });
    element.addEventListener("keydown", handleKeydown, eventOptions);
    element.addEventListener("blur", () => element.removeEventListener("keydown", handleKeydown), eventOptions);
  };

  // ../../../node_modules/motion-dom/dist/es/gestures/press/index.mjs
  function isValidPressEvent(event) {
    return isPrimaryPointer(event) && !isDragActive();
  }
  function press(elementOrSelector, onPressStart, options = {}) {
    const [elements, eventOptions, cancelEvents] = setupGesture(elementOrSelector, options);
    const startPress = (startEvent) => {
      const element = startEvent.currentTarget;
      if (!isValidPressEvent(startEvent) || isPressing.has(element))
        return;
      isPressing.add(element);
      const onPressEnd = onPressStart(startEvent);
      const onPointerEnd = (endEvent, success) => {
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        if (!isValidPressEvent(endEvent) || !isPressing.has(element)) {
          return;
        }
        isPressing.delete(element);
        if (typeof onPressEnd === "function") {
          onPressEnd(endEvent, { success });
        }
      };
      const onPointerUp = (upEvent) => {
        onPointerEnd(upEvent, options.useGlobalTarget || isNodeOrChild(element, upEvent.target));
      };
      const onPointerCancel = (cancelEvent) => {
        onPointerEnd(cancelEvent, false);
      };
      window.addEventListener("pointerup", onPointerUp, eventOptions);
      window.addEventListener("pointercancel", onPointerCancel, eventOptions);
    };
    elements.forEach((element) => {
      if (!isElementKeyboardAccessible(element) && element.getAttribute("tabindex") === null) {
        element.tabIndex = 0;
      }
      const target = options.useGlobalTarget ? window : element;
      target.addEventListener("pointerdown", startPress, eventOptions);
      element.addEventListener("focus", (event) => enableKeyboardPress(event, eventOptions), eventOptions);
    });
    return cancelEvents;
  }

  // ../../../node_modules/motion-dom/dist/es/gestures/drag/state/set-active.mjs
  function setDragLock(axis) {
    if (axis === "x" || axis === "y") {
      if (isDragging[axis]) {
        return null;
      } else {
        isDragging[axis] = true;
        return () => {
          isDragging[axis] = false;
        };
      }
    } else {
      if (isDragging.x || isDragging.y) {
        return null;
      } else {
        isDragging.x = isDragging.y = true;
        return () => {
          isDragging.x = isDragging.y = false;
        };
      }
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/keys-position.mjs
  var positionalKeys = /* @__PURE__ */ new Set([
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
    ...transformPropOrder
  ]);

  // ../../../node_modules/framer-motion/dist/es/frameloop/sync-time.mjs
  var now;
  function clearTime() {
    now = void 0;
  }
  var time = {
    now: () => {
      if (now === void 0) {
        time.set(frameData.isProcessing || MotionGlobalConfig.useManualTiming ? frameData.timestamp : performance.now());
      }
      return now;
    },
    set: (newTime) => {
      now = newTime;
      queueMicrotask(clearTime);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/array.mjs
  function addUniqueItem(arr, item) {
    if (arr.indexOf(item) === -1)
      arr.push(item);
  }
  function removeItem(arr, item) {
    const index = arr.indexOf(item);
    if (index > -1)
      arr.splice(index, 1);
  }

  // ../../../node_modules/framer-motion/dist/es/utils/subscription-manager.mjs
  var SubscriptionManager = class {
    constructor() {
      this.subscriptions = [];
    }
    add(handler) {
      addUniqueItem(this.subscriptions, handler);
      return () => removeItem(this.subscriptions, handler);
    }
    notify(a, b, c) {
      const numSubscriptions = this.subscriptions.length;
      if (!numSubscriptions)
        return;
      if (numSubscriptions === 1) {
        this.subscriptions[0](a, b, c);
      } else {
        for (let i = 0; i < numSubscriptions; i++) {
          const handler = this.subscriptions[i];
          handler && handler(a, b, c);
        }
      }
    }
    getSize() {
      return this.subscriptions.length;
    }
    clear() {
      this.subscriptions.length = 0;
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/velocity-per-second.mjs
  function velocityPerSecond(velocity, frameDuration) {
    return frameDuration ? velocity * (1e3 / frameDuration) : 0;
  }

  // ../../../node_modules/framer-motion/dist/es/value/index.mjs
  var MAX_VELOCITY_DELTA = 30;
  var isFloat = (value) => {
    return !isNaN(parseFloat(value));
  };
  var collectMotionValues = {
    current: void 0
  };
  var MotionValue = class {
    /**
     * @param init - The initiating value
     * @param config - Optional configuration options
     *
     * -  `transformer`: A function to transform incoming values with.
     *
     * @internal
     */
    constructor(init, options = {}) {
      this.version = "11.18.2";
      this.canTrackVelocity = null;
      this.events = {};
      this.updateAndNotify = (v, render = true) => {
        const currentTime = time.now();
        if (this.updatedAt !== currentTime) {
          this.setPrevFrameValue();
        }
        this.prev = this.current;
        this.setCurrent(v);
        if (this.current !== this.prev && this.events.change) {
          this.events.change.notify(this.current);
        }
        if (render && this.events.renderRequest) {
          this.events.renderRequest.notify(this.current);
        }
      };
      this.hasAnimated = false;
      this.setCurrent(init);
      this.owner = options.owner;
    }
    setCurrent(current) {
      this.current = current;
      this.updatedAt = time.now();
      if (this.canTrackVelocity === null && current !== void 0) {
        this.canTrackVelocity = isFloat(this.current);
      }
    }
    setPrevFrameValue(prevFrameValue = this.current) {
      this.prevFrameValue = prevFrameValue;
      this.prevUpdatedAt = this.updatedAt;
    }
    /**
     * Adds a function that will be notified when the `MotionValue` is updated.
     *
     * It returns a function that, when called, will cancel the subscription.
     *
     * When calling `onChange` inside a React component, it should be wrapped with the
     * `useEffect` hook. As it returns an unsubscribe function, this should be returned
     * from the `useEffect` function to ensure you don't add duplicate subscribers..
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *   const y = useMotionValue(0)
     *   const opacity = useMotionValue(1)
     *
     *   useEffect(() => {
     *     function updateOpacity() {
     *       const maxXY = Math.max(x.get(), y.get())
     *       const newOpacity = transform(maxXY, [0, 100], [1, 0])
     *       opacity.set(newOpacity)
     *     }
     *
     *     const unsubscribeX = x.on("change", updateOpacity)
     *     const unsubscribeY = y.on("change", updateOpacity)
     *
     *     return () => {
     *       unsubscribeX()
     *       unsubscribeY()
     *     }
     *   }, [])
     *
     *   return <motion.div style={{ x }} />
     * }
     * ```
     *
     * @param subscriber - A function that receives the latest value.
     * @returns A function that, when called, will cancel this subscription.
     *
     * @deprecated
     */
    onChange(subscription) {
      if (true) {
        warnOnce(false, `value.onChange(callback) is deprecated. Switch to value.on("change", callback).`);
      }
      return this.on("change", subscription);
    }
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = new SubscriptionManager();
      }
      const unsubscribe = this.events[eventName].add(callback);
      if (eventName === "change") {
        return () => {
          unsubscribe();
          frame.read(() => {
            if (!this.events.change.getSize()) {
              this.stop();
            }
          });
        };
      }
      return unsubscribe;
    }
    clearListeners() {
      for (const eventManagers in this.events) {
        this.events[eventManagers].clear();
      }
    }
    /**
     * Attaches a passive effect to the `MotionValue`.
     *
     * @internal
     */
    attach(passiveEffect, stopPassiveEffect) {
      this.passiveEffect = passiveEffect;
      this.stopPassiveEffect = stopPassiveEffect;
    }
    /**
     * Sets the state of the `MotionValue`.
     *
     * @remarks
     *
     * ```jsx
     * const x = useMotionValue(0)
     * x.set(10)
     * ```
     *
     * @param latest - Latest value to set.
     * @param render - Whether to notify render subscribers. Defaults to `true`
     *
     * @public
     */
    set(v, render = true) {
      if (!render || !this.passiveEffect) {
        this.updateAndNotify(v, render);
      } else {
        this.passiveEffect(v, this.updateAndNotify);
      }
    }
    setWithVelocity(prev, current, delta) {
      this.set(current);
      this.prev = void 0;
      this.prevFrameValue = prev;
      this.prevUpdatedAt = this.updatedAt - delta;
    }
    /**
     * Set the state of the `MotionValue`, stopping any active animations,
     * effects, and resets velocity to `0`.
     */
    jump(v, endAnimation = true) {
      this.updateAndNotify(v);
      this.prev = v;
      this.prevUpdatedAt = this.prevFrameValue = void 0;
      endAnimation && this.stop();
      if (this.stopPassiveEffect)
        this.stopPassiveEffect();
    }
    /**
     * Returns the latest state of `MotionValue`
     *
     * @returns - The latest state of `MotionValue`
     *
     * @public
     */
    get() {
      if (collectMotionValues.current) {
        collectMotionValues.current.push(this);
      }
      return this.current;
    }
    /**
     * @public
     */
    getPrevious() {
      return this.prev;
    }
    /**
     * Returns the latest velocity of `MotionValue`
     *
     * @returns - The latest velocity of `MotionValue`. Returns `0` if the state is non-numerical.
     *
     * @public
     */
    getVelocity() {
      const currentTime = time.now();
      if (!this.canTrackVelocity || this.prevFrameValue === void 0 || currentTime - this.updatedAt > MAX_VELOCITY_DELTA) {
        return 0;
      }
      const delta = Math.min(this.updatedAt - this.prevUpdatedAt, MAX_VELOCITY_DELTA);
      return velocityPerSecond(parseFloat(this.current) - parseFloat(this.prevFrameValue), delta);
    }
    /**
     * Registers a new animation to control this `MotionValue`. Only one
     * animation can drive a `MotionValue` at one time.
     *
     * ```jsx
     * value.start()
     * ```
     *
     * @param animation - A function that starts the provided animation
     *
     * @internal
     */
    start(startAnimation) {
      this.stop();
      return new Promise((resolve) => {
        this.hasAnimated = true;
        this.animation = startAnimation(resolve);
        if (this.events.animationStart) {
          this.events.animationStart.notify();
        }
      }).then(() => {
        if (this.events.animationComplete) {
          this.events.animationComplete.notify();
        }
        this.clearAnimation();
      });
    }
    /**
     * Stop the currently active animation.
     *
     * @public
     */
    stop() {
      if (this.animation) {
        this.animation.stop();
        if (this.events.animationCancel) {
          this.events.animationCancel.notify();
        }
      }
      this.clearAnimation();
    }
    /**
     * Returns `true` if this value is currently animating.
     *
     * @public
     */
    isAnimating() {
      return !!this.animation;
    }
    clearAnimation() {
      delete this.animation;
    }
    /**
     * Destroy and clean up subscribers to this `MotionValue`.
     *
     * The `MotionValue` hooks like `useMotionValue` and `useTransform` automatically
     * handle the lifecycle of the returned `MotionValue`, so this method is only necessary if you've manually
     * created a `MotionValue` via the `motionValue` function.
     *
     * @public
     */
    destroy() {
      this.clearListeners();
      this.stop();
      if (this.stopPassiveEffect) {
        this.stopPassiveEffect();
      }
    }
  };
  function motionValue(init, options) {
    return new MotionValue(init, options);
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/setters.mjs
  function setMotionValue(visualElement, key, value) {
    if (visualElement.hasValue(key)) {
      visualElement.getValue(key).set(value);
    } else {
      visualElement.addValue(key, motionValue(value));
    }
  }
  function setTarget(visualElement, definition) {
    const resolved = resolveVariant(visualElement, definition);
    let { transitionEnd = {}, transition = {}, ...target } = resolved || {};
    target = { ...target, ...transitionEnd };
    for (const key in target) {
      const value = resolveFinalValueInKeyframes(target[key]);
      setMotionValue(visualElement, key, value);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/value/use-will-change/is.mjs
  function isWillChangeMotionValue(value) {
    return Boolean(isMotionValue(value) && value.add);
  }

  // ../../../node_modules/framer-motion/dist/es/value/use-will-change/add-will-change.mjs
  function addValueToWillChange(visualElement, key) {
    const willChange = visualElement.getValue("willChange");
    if (isWillChangeMotionValue(willChange)) {
      return willChange.add(key);
    }
  }

  // ../../../node_modules/framer-motion/dist/es/animation/optimized-appear/get-appear-id.mjs
  function getOptimisedAppearId(visualElement) {
    return visualElement.props[optimizedAppearDataAttribute];
  }

  // ../../../node_modules/framer-motion/dist/es/utils/use-instant-transition-state.mjs
  var instantAnimationState = {
    current: false
  };

  // ../../../node_modules/framer-motion/dist/es/easing/cubic-bezier.mjs
  var calcBezier = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
  var subdivisionPrecision = 1e-7;
  var subdivisionMaxIterations = 12;
  function binarySubdivide(x, lowerBound, upperBound, mX1, mX2) {
    let currentX;
    let currentT;
    let i = 0;
    do {
      currentT = lowerBound + (upperBound - lowerBound) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0) {
        upperBound = currentT;
      } else {
        lowerBound = currentT;
      }
    } while (Math.abs(currentX) > subdivisionPrecision && ++i < subdivisionMaxIterations);
    return currentT;
  }
  function cubicBezier(mX1, mY1, mX2, mY2) {
    if (mX1 === mY1 && mX2 === mY2)
      return noop;
    const getTForX = (aX) => binarySubdivide(aX, 0, 1, mX1, mX2);
    return (t) => t === 0 || t === 1 ? t : calcBezier(getTForX(t), mY1, mY2);
  }

  // ../../../node_modules/framer-motion/dist/es/easing/modifiers/mirror.mjs
  var mirrorEasing = (easing) => (p) => p <= 0.5 ? easing(2 * p) / 2 : (2 - easing(2 * (1 - p))) / 2;

  // ../../../node_modules/framer-motion/dist/es/easing/modifiers/reverse.mjs
  var reverseEasing = (easing) => (p) => 1 - easing(1 - p);

  // ../../../node_modules/framer-motion/dist/es/easing/back.mjs
  var backOut = /* @__PURE__ */ cubicBezier(0.33, 1.53, 0.69, 0.99);
  var backIn = /* @__PURE__ */ reverseEasing(backOut);
  var backInOut = /* @__PURE__ */ mirrorEasing(backIn);

  // ../../../node_modules/framer-motion/dist/es/easing/anticipate.mjs
  var anticipate = (p) => (p *= 2) < 1 ? 0.5 * backIn(p) : 0.5 * (2 - Math.pow(2, -10 * (p - 1)));

  // ../../../node_modules/framer-motion/dist/es/easing/circ.mjs
  var circIn = (p) => 1 - Math.sin(Math.acos(p));
  var circOut = reverseEasing(circIn);
  var circInOut = mirrorEasing(circIn);

  // ../../../node_modules/framer-motion/dist/es/utils/is-zero-value-string.mjs
  var isZeroValueString = (v) => /^0[^.\s]+$/u.test(v);

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-none.mjs
  function isNone(value) {
    if (typeof value === "number") {
      return value === 0;
    } else if (value !== null) {
      return value === "none" || value === "0" || isZeroValueString(value);
    } else {
      return true;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/sanitize.mjs
  var sanitize = (v) => Math.round(v * 1e5) / 1e5;

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/float-regex.mjs
  var floatRegex = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/is-nullish.mjs
  function isNullish(v) {
    return v == null;
  }

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/single-color-regex.mjs
  var singleColorRegex = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu;

  // ../../../node_modules/framer-motion/dist/es/value/types/color/utils.mjs
  var isColorString = (type, testProp) => (v) => {
    return Boolean(typeof v === "string" && singleColorRegex.test(v) && v.startsWith(type) || testProp && !isNullish(v) && Object.prototype.hasOwnProperty.call(v, testProp));
  };
  var splitColor = (aName, bName, cName) => (v) => {
    if (typeof v !== "string")
      return v;
    const [a, b, c, alpha2] = v.match(floatRegex);
    return {
      [aName]: parseFloat(a),
      [bName]: parseFloat(b),
      [cName]: parseFloat(c),
      alpha: alpha2 !== void 0 ? parseFloat(alpha2) : 1
    };
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/rgba.mjs
  var clampRgbUnit = (v) => clamp(0, 255, v);
  var rgbUnit = {
    ...number,
    transform: (v) => Math.round(clampRgbUnit(v))
  };
  var rgba = {
    test: /* @__PURE__ */ isColorString("rgb", "red"),
    parse: /* @__PURE__ */ splitColor("red", "green", "blue"),
    transform: ({ red, green, blue, alpha: alpha$1 = 1 }) => "rgba(" + rgbUnit.transform(red) + ", " + rgbUnit.transform(green) + ", " + rgbUnit.transform(blue) + ", " + sanitize(alpha.transform(alpha$1)) + ")"
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/hex.mjs
  function parseHex(v) {
    let r2 = "";
    let g = "";
    let b = "";
    let a = "";
    if (v.length > 5) {
      r2 = v.substring(1, 3);
      g = v.substring(3, 5);
      b = v.substring(5, 7);
      a = v.substring(7, 9);
    } else {
      r2 = v.substring(1, 2);
      g = v.substring(2, 3);
      b = v.substring(3, 4);
      a = v.substring(4, 5);
      r2 += r2;
      g += g;
      b += b;
      a += a;
    }
    return {
      red: parseInt(r2, 16),
      green: parseInt(g, 16),
      blue: parseInt(b, 16),
      alpha: a ? parseInt(a, 16) / 255 : 1
    };
  }
  var hex = {
    test: /* @__PURE__ */ isColorString("#"),
    parse: parseHex,
    transform: rgba.transform
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/hsla.mjs
  var hsla = {
    test: /* @__PURE__ */ isColorString("hsl", "hue"),
    parse: /* @__PURE__ */ splitColor("hue", "saturation", "lightness"),
    transform: ({ hue, saturation, lightness, alpha: alpha$1 = 1 }) => {
      return "hsla(" + Math.round(hue) + ", " + percent.transform(sanitize(saturation)) + ", " + percent.transform(sanitize(lightness)) + ", " + sanitize(alpha.transform(alpha$1)) + ")";
    }
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/color/index.mjs
  var color = {
    test: (v) => rgba.test(v) || hex.test(v) || hsla.test(v),
    parse: (v) => {
      if (rgba.test(v)) {
        return rgba.parse(v);
      } else if (hsla.test(v)) {
        return hsla.parse(v);
      } else {
        return hex.parse(v);
      }
    },
    transform: (v) => {
      return typeof v === "string" ? v : v.hasOwnProperty("red") ? rgba.transform(v) : hsla.transform(v);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/utils/color-regex.mjs
  var colorRegex = /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;

  // ../../../node_modules/framer-motion/dist/es/value/types/complex/index.mjs
  function test(v) {
    var _a, _b;
    return isNaN(v) && typeof v === "string" && (((_a = v.match(floatRegex)) === null || _a === void 0 ? void 0 : _a.length) || 0) + (((_b = v.match(colorRegex)) === null || _b === void 0 ? void 0 : _b.length) || 0) > 0;
  }
  var NUMBER_TOKEN = "number";
  var COLOR_TOKEN = "color";
  var VAR_TOKEN = "var";
  var VAR_FUNCTION_TOKEN = "var(";
  var SPLIT_TOKEN = "${}";
  var complexRegex = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
  function analyseComplexValue(value) {
    const originalValue = value.toString();
    const values = [];
    const indexes = {
      color: [],
      number: [],
      var: []
    };
    const types = [];
    let i = 0;
    const tokenised = originalValue.replace(complexRegex, (parsedValue) => {
      if (color.test(parsedValue)) {
        indexes.color.push(i);
        types.push(COLOR_TOKEN);
        values.push(color.parse(parsedValue));
      } else if (parsedValue.startsWith(VAR_FUNCTION_TOKEN)) {
        indexes.var.push(i);
        types.push(VAR_TOKEN);
        values.push(parsedValue);
      } else {
        indexes.number.push(i);
        types.push(NUMBER_TOKEN);
        values.push(parseFloat(parsedValue));
      }
      ++i;
      return SPLIT_TOKEN;
    });
    const split = tokenised.split(SPLIT_TOKEN);
    return { values, split, indexes, types };
  }
  function parseComplexValue(v) {
    return analyseComplexValue(v).values;
  }
  function createTransformer(source) {
    const { split, types } = analyseComplexValue(source);
    const numSections = split.length;
    return (v) => {
      let output = "";
      for (let i = 0; i < numSections; i++) {
        output += split[i];
        if (v[i] !== void 0) {
          const type = types[i];
          if (type === NUMBER_TOKEN) {
            output += sanitize(v[i]);
          } else if (type === COLOR_TOKEN) {
            output += color.transform(v[i]);
          } else {
            output += v[i];
          }
        }
      }
      return output;
    };
  }
  var convertNumbersToZero = (v) => typeof v === "number" ? 0 : v;
  function getAnimatableNone(v) {
    const parsed = parseComplexValue(v);
    const transformer = createTransformer(v);
    return transformer(parsed.map(convertNumbersToZero));
  }
  var complex = {
    test,
    parse: parseComplexValue,
    createTransformer,
    getAnimatableNone
  };

  // ../../../node_modules/framer-motion/dist/es/value/types/complex/filter.mjs
  var maxDefaults = /* @__PURE__ */ new Set(["brightness", "contrast", "saturate", "opacity"]);
  function applyDefaultFilter(v) {
    const [name, value] = v.slice(0, -1).split("(");
    if (name === "drop-shadow")
      return v;
    const [number2] = value.match(floatRegex) || [];
    if (!number2)
      return v;
    const unit = value.replace(number2, "");
    let defaultValue = maxDefaults.has(name) ? 1 : 0;
    if (number2 !== value)
      defaultValue *= 100;
    return name + "(" + defaultValue + unit + ")";
  }
  var functionRegex = /\b([a-z-]*)\(.*?\)/gu;
  var filter = {
    ...complex,
    getAnimatableNone: (v) => {
      const functions = v.match(functionRegex);
      return functions ? functions.map(applyDefaultFilter).join(" ") : v;
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/defaults.mjs
  var defaultValueTypes = {
    ...numberValueTypes,
    // Color props
    color,
    backgroundColor: color,
    outlineColor: color,
    fill: color,
    stroke: color,
    // Border props
    borderColor: color,
    borderTopColor: color,
    borderRightColor: color,
    borderBottomColor: color,
    borderLeftColor: color,
    filter,
    WebkitFilter: filter
  };
  var getDefaultValueType = (key) => defaultValueTypes[key];

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/animatable-none.mjs
  function getAnimatableNone2(key, value) {
    let defaultValueType = getDefaultValueType(key);
    if (defaultValueType !== filter)
      defaultValueType = complex;
    return defaultValueType.getAnimatableNone ? defaultValueType.getAnimatableNone(value) : void 0;
  }

  // ../../../node_modules/framer-motion/dist/es/render/html/utils/make-none-animatable.mjs
  var invalidTemplates = /* @__PURE__ */ new Set(["auto", "none", "0"]);
  function makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name) {
    let i = 0;
    let animatableTemplate = void 0;
    while (i < unresolvedKeyframes.length && !animatableTemplate) {
      const keyframe = unresolvedKeyframes[i];
      if (typeof keyframe === "string" && !invalidTemplates.has(keyframe) && analyseComplexValue(keyframe).values.length) {
        animatableTemplate = unresolvedKeyframes[i];
      }
      i++;
    }
    if (animatableTemplate && name) {
      for (const noneIndex of noneKeyframeIndexes) {
        unresolvedKeyframes[noneIndex] = getAnimatableNone2(name, animatableTemplate);
      }
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/unit-conversion.mjs
  var isNumOrPxType = (v) => v === number || v === px;
  var getPosFromMatrix = (matrix, pos) => parseFloat(matrix.split(", ")[pos]);
  var getTranslateFromMatrix = (pos2, pos3) => (_bbox, { transform }) => {
    if (transform === "none" || !transform)
      return 0;
    const matrix3d = transform.match(/^matrix3d\((.+)\)$/u);
    if (matrix3d) {
      return getPosFromMatrix(matrix3d[1], pos3);
    } else {
      const matrix = transform.match(/^matrix\((.+)\)$/u);
      if (matrix) {
        return getPosFromMatrix(matrix[1], pos2);
      } else {
        return 0;
      }
    }
  };
  var transformKeys = /* @__PURE__ */ new Set(["x", "y", "z"]);
  var nonTranslationalTransformKeys = transformPropOrder.filter((key) => !transformKeys.has(key));
  function removeNonTranslationalTransform(visualElement) {
    const removedTransforms = [];
    nonTranslationalTransformKeys.forEach((key) => {
      const value = visualElement.getValue(key);
      if (value !== void 0) {
        removedTransforms.push([key, value.get()]);
        value.set(key.startsWith("scale") ? 1 : 0);
      }
    });
    return removedTransforms;
  }
  var positionalValues = {
    // Dimensions
    width: ({ x }, { paddingLeft = "0", paddingRight = "0" }) => x.max - x.min - parseFloat(paddingLeft) - parseFloat(paddingRight),
    height: ({ y }, { paddingTop = "0", paddingBottom = "0" }) => y.max - y.min - parseFloat(paddingTop) - parseFloat(paddingBottom),
    top: (_bbox, { top }) => parseFloat(top),
    left: (_bbox, { left }) => parseFloat(left),
    bottom: ({ y }, { top }) => parseFloat(top) + (y.max - y.min),
    right: ({ x }, { left }) => parseFloat(left) + (x.max - x.min),
    // Transform
    x: getTranslateFromMatrix(4, 13),
    y: getTranslateFromMatrix(5, 14)
  };
  positionalValues.translateX = positionalValues.x;
  positionalValues.translateY = positionalValues.y;

  // ../../../node_modules/framer-motion/dist/es/render/utils/KeyframesResolver.mjs
  var toResolve = /* @__PURE__ */ new Set();
  var isScheduled = false;
  var anyNeedsMeasurement = false;
  function measureAllKeyframes() {
    if (anyNeedsMeasurement) {
      const resolversToMeasure = Array.from(toResolve).filter((resolver) => resolver.needsMeasurement);
      const elementsToMeasure = new Set(resolversToMeasure.map((resolver) => resolver.element));
      const transformsToRestore = /* @__PURE__ */ new Map();
      elementsToMeasure.forEach((element) => {
        const removedTransforms = removeNonTranslationalTransform(element);
        if (!removedTransforms.length)
          return;
        transformsToRestore.set(element, removedTransforms);
        element.render();
      });
      resolversToMeasure.forEach((resolver) => resolver.measureInitialState());
      elementsToMeasure.forEach((element) => {
        element.render();
        const restore = transformsToRestore.get(element);
        if (restore) {
          restore.forEach(([key, value]) => {
            var _a;
            (_a = element.getValue(key)) === null || _a === void 0 ? void 0 : _a.set(value);
          });
        }
      });
      resolversToMeasure.forEach((resolver) => resolver.measureEndState());
      resolversToMeasure.forEach((resolver) => {
        if (resolver.suspendedScrollY !== void 0) {
          window.scrollTo(0, resolver.suspendedScrollY);
        }
      });
    }
    anyNeedsMeasurement = false;
    isScheduled = false;
    toResolve.forEach((resolver) => resolver.complete());
    toResolve.clear();
  }
  function readAllKeyframes() {
    toResolve.forEach((resolver) => {
      resolver.readKeyframes();
      if (resolver.needsMeasurement) {
        anyNeedsMeasurement = true;
      }
    });
  }
  function flushKeyframeResolvers() {
    readAllKeyframes();
    measureAllKeyframes();
  }
  var KeyframeResolver = class {
    constructor(unresolvedKeyframes, onComplete, name, motionValue2, element, isAsync = false) {
      this.isComplete = false;
      this.isAsync = false;
      this.needsMeasurement = false;
      this.isScheduled = false;
      this.unresolvedKeyframes = [...unresolvedKeyframes];
      this.onComplete = onComplete;
      this.name = name;
      this.motionValue = motionValue2;
      this.element = element;
      this.isAsync = isAsync;
    }
    scheduleResolve() {
      this.isScheduled = true;
      if (this.isAsync) {
        toResolve.add(this);
        if (!isScheduled) {
          isScheduled = true;
          frame.read(readAllKeyframes);
          frame.resolveKeyframes(measureAllKeyframes);
        }
      } else {
        this.readKeyframes();
        this.complete();
      }
    }
    readKeyframes() {
      const { unresolvedKeyframes, name, element, motionValue: motionValue2 } = this;
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        if (unresolvedKeyframes[i] === null) {
          if (i === 0) {
            const currentValue = motionValue2 === null || motionValue2 === void 0 ? void 0 : motionValue2.get();
            const finalKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
            if (currentValue !== void 0) {
              unresolvedKeyframes[0] = currentValue;
            } else if (element && name) {
              const valueAsRead = element.readValue(name, finalKeyframe);
              if (valueAsRead !== void 0 && valueAsRead !== null) {
                unresolvedKeyframes[0] = valueAsRead;
              }
            }
            if (unresolvedKeyframes[0] === void 0) {
              unresolvedKeyframes[0] = finalKeyframe;
            }
            if (motionValue2 && currentValue === void 0) {
              motionValue2.set(unresolvedKeyframes[0]);
            }
          } else {
            unresolvedKeyframes[i] = unresolvedKeyframes[i - 1];
          }
        }
      }
    }
    setFinalKeyframe() {
    }
    measureInitialState() {
    }
    renderEndStyles() {
    }
    measureEndState() {
    }
    complete() {
      this.isComplete = true;
      this.onComplete(this.unresolvedKeyframes, this.finalKeyframe);
      toResolve.delete(this);
    }
    cancel() {
      if (!this.isComplete) {
        this.isScheduled = false;
        toResolve.delete(this);
      }
    }
    resume() {
      if (!this.isComplete)
        this.scheduleResolve();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/is-numerical-string.mjs
  var isNumericalString = (v) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(v);

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/css-variables-conversion.mjs
  var splitCSSVariableRegex = (
    // eslint-disable-next-line redos-detector/no-unsafe-regex -- false positive, as it can match a lot of words
    /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u
  );
  function parseCSSVariable(current) {
    const match = splitCSSVariableRegex.exec(current);
    if (!match)
      return [,];
    const [, token1, token2, fallback] = match;
    return [`--${token1 !== null && token1 !== void 0 ? token1 : token2}`, fallback];
  }
  var maxDepth = 4;
  function getVariableValue(current, element, depth = 1) {
    invariant(depth <= maxDepth, `Max CSS variable fallback depth detected in property "${current}". This may indicate a circular fallback dependency.`);
    const [token, fallback] = parseCSSVariable(current);
    if (!token)
      return;
    const resolved = window.getComputedStyle(element).getPropertyValue(token);
    if (resolved) {
      const trimmed = resolved.trim();
      return isNumericalString(trimmed) ? parseFloat(trimmed) : trimmed;
    }
    return isCSSVariableToken(fallback) ? getVariableValue(fallback, element, depth + 1) : fallback;
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/test.mjs
  var testValueType = (v) => (type) => type.test(v);

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/type-auto.mjs
  var auto = {
    test: (v) => v === "auto",
    parse: (v) => v
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/dimensions.mjs
  var dimensionValueTypes = [number, px, percent, degrees, vw, vh, auto];
  var findDimensionValueType = (v) => dimensionValueTypes.find(testValueType(v));

  // ../../../node_modules/framer-motion/dist/es/render/dom/DOMKeyframesResolver.mjs
  var DOMKeyframesResolver = class extends KeyframeResolver {
    constructor(unresolvedKeyframes, onComplete, name, motionValue2, element) {
      super(unresolvedKeyframes, onComplete, name, motionValue2, element, true);
    }
    readKeyframes() {
      const { unresolvedKeyframes, element, name } = this;
      if (!element || !element.current)
        return;
      super.readKeyframes();
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        let keyframe = unresolvedKeyframes[i];
        if (typeof keyframe === "string") {
          keyframe = keyframe.trim();
          if (isCSSVariableToken(keyframe)) {
            const resolved = getVariableValue(keyframe, element.current);
            if (resolved !== void 0) {
              unresolvedKeyframes[i] = resolved;
            }
            if (i === unresolvedKeyframes.length - 1) {
              this.finalKeyframe = keyframe;
            }
          }
        }
      }
      this.resolveNoneKeyframes();
      if (!positionalKeys.has(name) || unresolvedKeyframes.length !== 2) {
        return;
      }
      const [origin, target] = unresolvedKeyframes;
      const originType = findDimensionValueType(origin);
      const targetType = findDimensionValueType(target);
      if (originType === targetType)
        return;
      if (isNumOrPxType(originType) && isNumOrPxType(targetType)) {
        for (let i = 0; i < unresolvedKeyframes.length; i++) {
          const value = unresolvedKeyframes[i];
          if (typeof value === "string") {
            unresolvedKeyframes[i] = parseFloat(value);
          }
        }
      } else {
        this.needsMeasurement = true;
      }
    }
    resolveNoneKeyframes() {
      const { unresolvedKeyframes, name } = this;
      const noneKeyframeIndexes = [];
      for (let i = 0; i < unresolvedKeyframes.length; i++) {
        if (isNone(unresolvedKeyframes[i])) {
          noneKeyframeIndexes.push(i);
        }
      }
      if (noneKeyframeIndexes.length) {
        makeNoneKeyframesAnimatable(unresolvedKeyframes, noneKeyframeIndexes, name);
      }
    }
    measureInitialState() {
      const { element, unresolvedKeyframes, name } = this;
      if (!element || !element.current)
        return;
      if (name === "height") {
        this.suspendedScrollY = window.pageYOffset;
      }
      this.measuredOrigin = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
      unresolvedKeyframes[0] = this.measuredOrigin;
      const measureKeyframe = unresolvedKeyframes[unresolvedKeyframes.length - 1];
      if (measureKeyframe !== void 0) {
        element.getValue(name, measureKeyframe).jump(measureKeyframe, false);
      }
    }
    measureEndState() {
      var _a;
      const { element, name, unresolvedKeyframes } = this;
      if (!element || !element.current)
        return;
      const value = element.getValue(name);
      value && value.jump(this.measuredOrigin, false);
      const finalKeyframeIndex = unresolvedKeyframes.length - 1;
      const finalKeyframe = unresolvedKeyframes[finalKeyframeIndex];
      unresolvedKeyframes[finalKeyframeIndex] = positionalValues[name](element.measureViewportBox(), window.getComputedStyle(element.current));
      if (finalKeyframe !== null && this.finalKeyframe === void 0) {
        this.finalKeyframe = finalKeyframe;
      }
      if ((_a = this.removedTransforms) === null || _a === void 0 ? void 0 : _a.length) {
        this.removedTransforms.forEach(([unsetTransformName, unsetTransformValue]) => {
          element.getValue(unsetTransformName).set(unsetTransformValue);
        });
      }
      this.resolveNoneKeyframes();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-animatable.mjs
  var isAnimatable = (value, name) => {
    if (name === "zIndex")
      return false;
    if (typeof value === "number" || Array.isArray(value))
      return true;
    if (typeof value === "string" && // It's animatable if we have a string
    (complex.test(value) || value === "0") && // And it contains numbers and/or colors
    !value.startsWith("url(")) {
      return true;
    }
    return false;
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animators/utils/can-animate.mjs
  function hasKeyframesChanged(keyframes2) {
    const current = keyframes2[0];
    if (keyframes2.length === 1)
      return true;
    for (let i = 0; i < keyframes2.length; i++) {
      if (keyframes2[i] !== current)
        return true;
    }
  }
  function canAnimate(keyframes2, name, type, velocity) {
    const originKeyframe = keyframes2[0];
    if (originKeyframe === null)
      return false;
    if (name === "display" || name === "visibility")
      return true;
    const targetKeyframe = keyframes2[keyframes2.length - 1];
    const isOriginAnimatable = isAnimatable(originKeyframe, name);
    const isTargetAnimatable = isAnimatable(targetKeyframe, name);
    warning(isOriginAnimatable === isTargetAnimatable, `You are trying to animate ${name} from "${originKeyframe}" to "${targetKeyframe}". ${originKeyframe} is not an animatable value - to enable this animation set ${originKeyframe} to a value animatable to ${targetKeyframe} via the \`style\` property.`);
    if (!isOriginAnimatable || !isTargetAnimatable) {
      return false;
    }
    return hasKeyframesChanged(keyframes2) || (type === "spring" || isGenerator(type)) && velocity;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/waapi/utils/get-final-keyframe.mjs
  var isNotNull = (value) => value !== null;
  function getFinalKeyframe(keyframes2, { repeat, repeatType = "loop" }, finalKeyframe) {
    const resolvedKeyframes = keyframes2.filter(isNotNull);
    const index = repeat && repeatType !== "loop" && repeat % 2 === 1 ? 0 : resolvedKeyframes.length - 1;
    return !index || finalKeyframe === void 0 ? resolvedKeyframes[index] : finalKeyframe;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/BaseAnimation.mjs
  var MAX_RESOLVE_DELAY = 40;
  var BaseAnimation = class {
    constructor({ autoplay = true, delay: delay2 = 0, type = "keyframes", repeat = 0, repeatDelay = 0, repeatType = "loop", ...options }) {
      this.isStopped = false;
      this.hasAttemptedResolve = false;
      this.createdAt = time.now();
      this.options = {
        autoplay,
        delay: delay2,
        type,
        repeat,
        repeatDelay,
        repeatType,
        ...options
      };
      this.updateFinishedPromise();
    }
    /**
     * This method uses the createdAt and resolvedAt to calculate the
     * animation startTime. *Ideally*, we would use the createdAt time as t=0
     * as the following frame would then be the first frame of the animation in
     * progress, which would feel snappier.
     *
     * However, if there's a delay (main thread work) between the creation of
     * the animation and the first commited frame, we prefer to use resolvedAt
     * to avoid a sudden jump into the animation.
     */
    calcStartTime() {
      if (!this.resolvedAt)
        return this.createdAt;
      return this.resolvedAt - this.createdAt > MAX_RESOLVE_DELAY ? this.resolvedAt : this.createdAt;
    }
    /**
     * A getter for resolved data. If keyframes are not yet resolved, accessing
     * this.resolved will synchronously flush all pending keyframe resolvers.
     * This is a deoptimisation, but at its worst still batches read/writes.
     */
    get resolved() {
      if (!this._resolved && !this.hasAttemptedResolve) {
        flushKeyframeResolvers();
      }
      return this._resolved;
    }
    /**
     * A method to be called when the keyframes resolver completes. This method
     * will check if its possible to run the animation and, if not, skip it.
     * Otherwise, it will call initPlayback on the implementing class.
     */
    onKeyframesResolved(keyframes2, finalKeyframe) {
      this.resolvedAt = time.now();
      this.hasAttemptedResolve = true;
      const { name, type, velocity, delay: delay2, onComplete, onUpdate, isGenerator: isGenerator2 } = this.options;
      if (!isGenerator2 && !canAnimate(keyframes2, name, type, velocity)) {
        if (instantAnimationState.current || !delay2) {
          onUpdate && onUpdate(getFinalKeyframe(keyframes2, this.options, finalKeyframe));
          onComplete && onComplete();
          this.resolveFinishedPromise();
          return;
        } else {
          this.options.duration = 0;
        }
      }
      const resolvedAnimation = this.initPlayback(keyframes2, finalKeyframe);
      if (resolvedAnimation === false)
        return;
      this._resolved = {
        keyframes: keyframes2,
        finalKeyframe,
        ...resolvedAnimation
      };
      this.onPostResolved();
    }
    onPostResolved() {
    }
    /**
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve, reject) {
      return this.currentFinishedPromise.then(resolve, reject);
    }
    flatten() {
      this.options.type = "keyframes";
      this.options.ease = "linear";
    }
    updateFinishedPromise() {
      this.currentFinishedPromise = new Promise((resolve) => {
        this.resolveFinishedPromise = resolve;
      });
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/mix/number.mjs
  var mixNumber = (from, to, progress2) => {
    return from + (to - from) * progress2;
  };

  // ../../../node_modules/framer-motion/dist/es/utils/hsla-to-rgba.mjs
  function hueToRgb(p, q, t) {
    if (t < 0)
      t += 1;
    if (t > 1)
      t -= 1;
    if (t < 1 / 6)
      return p + (q - p) * 6 * t;
    if (t < 1 / 2)
      return q;
    if (t < 2 / 3)
      return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hslaToRgba({ hue, saturation, lightness, alpha: alpha2 }) {
    hue /= 360;
    saturation /= 100;
    lightness /= 100;
    let red = 0;
    let green = 0;
    let blue = 0;
    if (!saturation) {
      red = green = blue = lightness;
    } else {
      const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
      const p = 2 * lightness - q;
      red = hueToRgb(p, q, hue + 1 / 3);
      green = hueToRgb(p, q, hue);
      blue = hueToRgb(p, q, hue - 1 / 3);
    }
    return {
      red: Math.round(red * 255),
      green: Math.round(green * 255),
      blue: Math.round(blue * 255),
      alpha: alpha2
    };
  }

  // ../../../node_modules/framer-motion/dist/es/utils/mix/immediate.mjs
  function mixImmediate(a, b) {
    return (p) => p > 0 ? b : a;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/mix/color.mjs
  var mixLinearColor = (from, to, v) => {
    const fromExpo = from * from;
    const expo = v * (to * to - fromExpo) + fromExpo;
    return expo < 0 ? 0 : Math.sqrt(expo);
  };
  var colorTypes = [hex, rgba, hsla];
  var getColorType = (v) => colorTypes.find((type) => type.test(v));
  function asRGBA(color2) {
    const type = getColorType(color2);
    warning(Boolean(type), `'${color2}' is not an animatable color. Use the equivalent color code instead.`);
    if (!Boolean(type))
      return false;
    let model = type.parse(color2);
    if (type === hsla) {
      model = hslaToRgba(model);
    }
    return model;
  }
  var mixColor = (from, to) => {
    const fromRGBA = asRGBA(from);
    const toRGBA = asRGBA(to);
    if (!fromRGBA || !toRGBA) {
      return mixImmediate(from, to);
    }
    const blended = { ...fromRGBA };
    return (v) => {
      blended.red = mixLinearColor(fromRGBA.red, toRGBA.red, v);
      blended.green = mixLinearColor(fromRGBA.green, toRGBA.green, v);
      blended.blue = mixLinearColor(fromRGBA.blue, toRGBA.blue, v);
      blended.alpha = mixNumber(fromRGBA.alpha, toRGBA.alpha, v);
      return rgba.transform(blended);
    };
  };

  // ../../../node_modules/framer-motion/dist/es/utils/pipe.mjs
  var combineFunctions = (a, b) => (v) => b(a(v));
  var pipe = (...transformers) => transformers.reduce(combineFunctions);

  // ../../../node_modules/framer-motion/dist/es/utils/mix/visibility.mjs
  var invisibleValues = /* @__PURE__ */ new Set(["none", "hidden"]);
  function mixVisibility(origin, target) {
    if (invisibleValues.has(origin)) {
      return (p) => p <= 0 ? origin : target;
    } else {
      return (p) => p >= 1 ? target : origin;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/utils/mix/complex.mjs
  function mixNumber2(a, b) {
    return (p) => mixNumber(a, b, p);
  }
  function getMixer(a) {
    if (typeof a === "number") {
      return mixNumber2;
    } else if (typeof a === "string") {
      return isCSSVariableToken(a) ? mixImmediate : color.test(a) ? mixColor : mixComplex;
    } else if (Array.isArray(a)) {
      return mixArray;
    } else if (typeof a === "object") {
      return color.test(a) ? mixColor : mixObject;
    }
    return mixImmediate;
  }
  function mixArray(a, b) {
    const output = [...a];
    const numValues = output.length;
    const blendValue = a.map((v, i) => getMixer(v)(v, b[i]));
    return (p) => {
      for (let i = 0; i < numValues; i++) {
        output[i] = blendValue[i](p);
      }
      return output;
    };
  }
  function mixObject(a, b) {
    const output = { ...a, ...b };
    const blendValue = {};
    for (const key in output) {
      if (a[key] !== void 0 && b[key] !== void 0) {
        blendValue[key] = getMixer(a[key])(a[key], b[key]);
      }
    }
    return (v) => {
      for (const key in blendValue) {
        output[key] = blendValue[key](v);
      }
      return output;
    };
  }
  function matchOrder(origin, target) {
    var _a;
    const orderedOrigin = [];
    const pointers = { color: 0, var: 0, number: 0 };
    for (let i = 0; i < target.values.length; i++) {
      const type = target.types[i];
      const originIndex = origin.indexes[type][pointers[type]];
      const originValue = (_a = origin.values[originIndex]) !== null && _a !== void 0 ? _a : 0;
      orderedOrigin[i] = originValue;
      pointers[type]++;
    }
    return orderedOrigin;
  }
  var mixComplex = (origin, target) => {
    const template = complex.createTransformer(target);
    const originStats = analyseComplexValue(origin);
    const targetStats = analyseComplexValue(target);
    const canInterpolate = originStats.indexes.var.length === targetStats.indexes.var.length && originStats.indexes.color.length === targetStats.indexes.color.length && originStats.indexes.number.length >= targetStats.indexes.number.length;
    if (canInterpolate) {
      if (invisibleValues.has(origin) && !targetStats.values.length || invisibleValues.has(target) && !originStats.values.length) {
        return mixVisibility(origin, target);
      }
      return pipe(mixArray(matchOrder(originStats, targetStats), targetStats.values), template);
    } else {
      warning(true, `Complex values '${origin}' and '${target}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`);
      return mixImmediate(origin, target);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/mix/index.mjs
  function mix(from, to, p) {
    if (typeof from === "number" && typeof to === "number" && typeof p === "number") {
      return mixNumber(from, to, p);
    }
    const mixer = getMixer(from);
    return mixer(from, to);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/utils/velocity.mjs
  var velocitySampleDuration = 5;
  function calcGeneratorVelocity(resolveValue, t, current) {
    const prevT = Math.max(t - velocitySampleDuration, 0);
    return velocityPerSecond(current - resolveValue(prevT), t - prevT);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/spring/defaults.mjs
  var springDefaults = {
    // Default spring physics
    stiffness: 100,
    damping: 10,
    mass: 1,
    velocity: 0,
    // Default duration/bounce-based options
    duration: 800,
    // in ms
    bounce: 0.3,
    visualDuration: 0.3,
    // in seconds
    // Rest thresholds
    restSpeed: {
      granular: 0.01,
      default: 2
    },
    restDelta: {
      granular: 5e-3,
      default: 0.5
    },
    // Limits
    minDuration: 0.01,
    // in seconds
    maxDuration: 10,
    // in seconds
    minDamping: 0.05,
    maxDamping: 1
  };

  // ../../../node_modules/framer-motion/dist/es/animation/generators/spring/find.mjs
  var safeMin = 1e-3;
  function findSpring({ duration = springDefaults.duration, bounce = springDefaults.bounce, velocity = springDefaults.velocity, mass = springDefaults.mass }) {
    let envelope;
    let derivative;
    warning(duration <= secondsToMilliseconds(springDefaults.maxDuration), "Spring duration must be 10 seconds or less");
    let dampingRatio = 1 - bounce;
    dampingRatio = clamp(springDefaults.minDamping, springDefaults.maxDamping, dampingRatio);
    duration = clamp(springDefaults.minDuration, springDefaults.maxDuration, millisecondsToSeconds(duration));
    if (dampingRatio < 1) {
      envelope = (undampedFreq2) => {
        const exponentialDecay = undampedFreq2 * dampingRatio;
        const delta = exponentialDecay * duration;
        const a = exponentialDecay - velocity;
        const b = calcAngularFreq(undampedFreq2, dampingRatio);
        const c = Math.exp(-delta);
        return safeMin - a / b * c;
      };
      derivative = (undampedFreq2) => {
        const exponentialDecay = undampedFreq2 * dampingRatio;
        const delta = exponentialDecay * duration;
        const d = delta * velocity + velocity;
        const e = Math.pow(dampingRatio, 2) * Math.pow(undampedFreq2, 2) * duration;
        const f = Math.exp(-delta);
        const g = calcAngularFreq(Math.pow(undampedFreq2, 2), dampingRatio);
        const factor = -envelope(undampedFreq2) + safeMin > 0 ? -1 : 1;
        return factor * ((d - e) * f) / g;
      };
    } else {
      envelope = (undampedFreq2) => {
        const a = Math.exp(-undampedFreq2 * duration);
        const b = (undampedFreq2 - velocity) * duration + 1;
        return -safeMin + a * b;
      };
      derivative = (undampedFreq2) => {
        const a = Math.exp(-undampedFreq2 * duration);
        const b = (velocity - undampedFreq2) * (duration * duration);
        return a * b;
      };
    }
    const initialGuess = 5 / duration;
    const undampedFreq = approximateRoot(envelope, derivative, initialGuess);
    duration = secondsToMilliseconds(duration);
    if (isNaN(undampedFreq)) {
      return {
        stiffness: springDefaults.stiffness,
        damping: springDefaults.damping,
        duration
      };
    } else {
      const stiffness = Math.pow(undampedFreq, 2) * mass;
      return {
        stiffness,
        damping: dampingRatio * 2 * Math.sqrt(mass * stiffness),
        duration
      };
    }
  }
  var rootIterations = 12;
  function approximateRoot(envelope, derivative, initialGuess) {
    let result = initialGuess;
    for (let i = 1; i < rootIterations; i++) {
      result = result - envelope(result) / derivative(result);
    }
    return result;
  }
  function calcAngularFreq(undampedFreq, dampingRatio) {
    return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/spring/index.mjs
  var durationKeys = ["duration", "bounce"];
  var physicsKeys = ["stiffness", "damping", "mass"];
  function isSpringType(options, keys) {
    return keys.some((key) => options[key] !== void 0);
  }
  function getSpringOptions(options) {
    let springOptions = {
      velocity: springDefaults.velocity,
      stiffness: springDefaults.stiffness,
      damping: springDefaults.damping,
      mass: springDefaults.mass,
      isResolvedFromDuration: false,
      ...options
    };
    if (!isSpringType(options, physicsKeys) && isSpringType(options, durationKeys)) {
      if (options.visualDuration) {
        const visualDuration = options.visualDuration;
        const root = 2 * Math.PI / (visualDuration * 1.2);
        const stiffness = root * root;
        const damping = 2 * clamp(0.05, 1, 1 - (options.bounce || 0)) * Math.sqrt(stiffness);
        springOptions = {
          ...springOptions,
          mass: springDefaults.mass,
          stiffness,
          damping
        };
      } else {
        const derived = findSpring(options);
        springOptions = {
          ...springOptions,
          ...derived,
          mass: springDefaults.mass
        };
        springOptions.isResolvedFromDuration = true;
      }
    }
    return springOptions;
  }
  function spring(optionsOrVisualDuration = springDefaults.visualDuration, bounce = springDefaults.bounce) {
    const options = typeof optionsOrVisualDuration !== "object" ? {
      visualDuration: optionsOrVisualDuration,
      keyframes: [0, 1],
      bounce
    } : optionsOrVisualDuration;
    let { restSpeed, restDelta } = options;
    const origin = options.keyframes[0];
    const target = options.keyframes[options.keyframes.length - 1];
    const state = { done: false, value: origin };
    const { stiffness, damping, mass, duration, velocity, isResolvedFromDuration } = getSpringOptions({
      ...options,
      velocity: -millisecondsToSeconds(options.velocity || 0)
    });
    const initialVelocity = velocity || 0;
    const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
    const initialDelta = target - origin;
    const undampedAngularFreq = millisecondsToSeconds(Math.sqrt(stiffness / mass));
    const isGranularScale = Math.abs(initialDelta) < 5;
    restSpeed || (restSpeed = isGranularScale ? springDefaults.restSpeed.granular : springDefaults.restSpeed.default);
    restDelta || (restDelta = isGranularScale ? springDefaults.restDelta.granular : springDefaults.restDelta.default);
    let resolveSpring;
    if (dampingRatio < 1) {
      const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio);
      resolveSpring = (t) => {
        const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
        return target - envelope * ((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) / angularFreq * Math.sin(angularFreq * t) + initialDelta * Math.cos(angularFreq * t));
      };
    } else if (dampingRatio === 1) {
      resolveSpring = (t) => target - Math.exp(-undampedAngularFreq * t) * (initialDelta + (initialVelocity + undampedAngularFreq * initialDelta) * t);
    } else {
      const dampedAngularFreq = undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1);
      resolveSpring = (t) => {
        const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t);
        const freqForT = Math.min(dampedAngularFreq * t, 300);
        return target - envelope * ((initialVelocity + dampingRatio * undampedAngularFreq * initialDelta) * Math.sinh(freqForT) + dampedAngularFreq * initialDelta * Math.cosh(freqForT)) / dampedAngularFreq;
      };
    }
    const generator = {
      calculatedDuration: isResolvedFromDuration ? duration || null : null,
      next: (t) => {
        const current = resolveSpring(t);
        if (!isResolvedFromDuration) {
          let currentVelocity = 0;
          if (dampingRatio < 1) {
            currentVelocity = t === 0 ? secondsToMilliseconds(initialVelocity) : calcGeneratorVelocity(resolveSpring, t, current);
          }
          const isBelowVelocityThreshold = Math.abs(currentVelocity) <= restSpeed;
          const isBelowDisplacementThreshold = Math.abs(target - current) <= restDelta;
          state.done = isBelowVelocityThreshold && isBelowDisplacementThreshold;
        } else {
          state.done = t >= duration;
        }
        state.value = state.done ? target : current;
        return state;
      },
      toString: () => {
        const calculatedDuration = Math.min(calcGeneratorDuration(generator), maxGeneratorDuration);
        const easing = generateLinearEasing((progress2) => generator.next(calculatedDuration * progress2).value, calculatedDuration, 30);
        return calculatedDuration + "ms " + easing;
      }
    };
    return generator;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/inertia.mjs
  function inertia({ keyframes: keyframes2, velocity = 0, power = 0.8, timeConstant = 325, bounceDamping = 10, bounceStiffness = 500, modifyTarget, min, max, restDelta = 0.5, restSpeed }) {
    const origin = keyframes2[0];
    const state = {
      done: false,
      value: origin
    };
    const isOutOfBounds = (v) => min !== void 0 && v < min || max !== void 0 && v > max;
    const nearestBoundary = (v) => {
      if (min === void 0)
        return max;
      if (max === void 0)
        return min;
      return Math.abs(min - v) < Math.abs(max - v) ? min : max;
    };
    let amplitude = power * velocity;
    const ideal = origin + amplitude;
    const target = modifyTarget === void 0 ? ideal : modifyTarget(ideal);
    if (target !== ideal)
      amplitude = target - origin;
    const calcDelta = (t) => -amplitude * Math.exp(-t / timeConstant);
    const calcLatest = (t) => target + calcDelta(t);
    const applyFriction = (t) => {
      const delta = calcDelta(t);
      const latest = calcLatest(t);
      state.done = Math.abs(delta) <= restDelta;
      state.value = state.done ? target : latest;
    };
    let timeReachedBoundary;
    let spring$1;
    const checkCatchBoundary = (t) => {
      if (!isOutOfBounds(state.value))
        return;
      timeReachedBoundary = t;
      spring$1 = spring({
        keyframes: [state.value, nearestBoundary(state.value)],
        velocity: calcGeneratorVelocity(calcLatest, t, state.value),
        // TODO: This should be passing * 1000
        damping: bounceDamping,
        stiffness: bounceStiffness,
        restDelta,
        restSpeed
      });
    };
    checkCatchBoundary(0);
    return {
      calculatedDuration: null,
      next: (t) => {
        let hasUpdatedFrame = false;
        if (!spring$1 && timeReachedBoundary === void 0) {
          hasUpdatedFrame = true;
          applyFriction(t);
          checkCatchBoundary(t);
        }
        if (timeReachedBoundary !== void 0 && t >= timeReachedBoundary) {
          return spring$1.next(t - timeReachedBoundary);
        } else {
          !hasUpdatedFrame && applyFriction(t);
          return state;
        }
      }
    };
  }

  // ../../../node_modules/framer-motion/dist/es/easing/ease.mjs
  var easeIn = /* @__PURE__ */ cubicBezier(0.42, 0, 1, 1);
  var easeOut = /* @__PURE__ */ cubicBezier(0, 0, 0.58, 1);
  var easeInOut = /* @__PURE__ */ cubicBezier(0.42, 0, 0.58, 1);

  // ../../../node_modules/framer-motion/dist/es/easing/utils/is-easing-array.mjs
  var isEasingArray = (ease2) => {
    return Array.isArray(ease2) && typeof ease2[0] !== "number";
  };

  // ../../../node_modules/framer-motion/dist/es/easing/utils/map.mjs
  var easingLookup = {
    linear: noop,
    easeIn,
    easeInOut,
    easeOut,
    circIn,
    circInOut,
    circOut,
    backIn,
    backInOut,
    backOut,
    anticipate
  };
  var easingDefinitionToFunction = (definition) => {
    if (isBezierDefinition(definition)) {
      invariant(definition.length === 4, `Cubic bezier arrays must contain four numerical values.`);
      const [x1, y1, x2, y2] = definition;
      return cubicBezier(x1, y1, x2, y2);
    } else if (typeof definition === "string") {
      invariant(easingLookup[definition] !== void 0, `Invalid easing type '${definition}'`);
      return easingLookup[definition];
    }
    return definition;
  };

  // ../../../node_modules/framer-motion/dist/es/utils/interpolate.mjs
  function createMixers(output, ease2, customMixer) {
    const mixers = [];
    const mixerFactory = customMixer || mix;
    const numMixers = output.length - 1;
    for (let i = 0; i < numMixers; i++) {
      let mixer = mixerFactory(output[i], output[i + 1]);
      if (ease2) {
        const easingFunction = Array.isArray(ease2) ? ease2[i] || noop : ease2;
        mixer = pipe(easingFunction, mixer);
      }
      mixers.push(mixer);
    }
    return mixers;
  }
  function interpolate(input, output, { clamp: isClamp = true, ease: ease2, mixer } = {}) {
    const inputLength = input.length;
    invariant(inputLength === output.length, "Both input and output ranges must be the same length");
    if (inputLength === 1)
      return () => output[0];
    if (inputLength === 2 && output[0] === output[1])
      return () => output[1];
    const isZeroDeltaRange = input[0] === input[1];
    if (input[0] > input[inputLength - 1]) {
      input = [...input].reverse();
      output = [...output].reverse();
    }
    const mixers = createMixers(output, ease2, mixer);
    const numMixers = mixers.length;
    const interpolator = (v) => {
      if (isZeroDeltaRange && v < input[0])
        return output[0];
      let i = 0;
      if (numMixers > 1) {
        for (; i < input.length - 2; i++) {
          if (v < input[i + 1])
            break;
        }
      }
      const progressInRange = progress(input[i], input[i + 1], v);
      return mixers[i](progressInRange);
    };
    return isClamp ? (v) => interpolator(clamp(input[0], input[inputLength - 1], v)) : interpolator;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/offsets/fill.mjs
  function fillOffset(offset, remaining) {
    const min = offset[offset.length - 1];
    for (let i = 1; i <= remaining; i++) {
      const offsetProgress = progress(0, remaining, i);
      offset.push(mixNumber(min, 1, offsetProgress));
    }
  }

  // ../../../node_modules/framer-motion/dist/es/utils/offsets/default.mjs
  function defaultOffset(arr) {
    const offset = [0];
    fillOffset(offset, arr.length - 1);
    return offset;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/offsets/time.mjs
  function convertOffsetToTimes(offset, duration) {
    return offset.map((o) => o * duration);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/generators/keyframes.mjs
  function defaultEasing(values, easing) {
    return values.map(() => easing || easeInOut).splice(0, values.length - 1);
  }
  function keyframes({ duration = 300, keyframes: keyframeValues, times, ease: ease2 = "easeInOut" }) {
    const easingFunctions = isEasingArray(ease2) ? ease2.map(easingDefinitionToFunction) : easingDefinitionToFunction(ease2);
    const state = {
      done: false,
      value: keyframeValues[0]
    };
    const absoluteTimes = convertOffsetToTimes(
      // Only use the provided offsets if they're the correct length
      // TODO Maybe we should warn here if there's a length mismatch
      times && times.length === keyframeValues.length ? times : defaultOffset(keyframeValues),
      duration
    );
    const mapTimeToKeyframe = interpolate(absoluteTimes, keyframeValues, {
      ease: Array.isArray(easingFunctions) ? easingFunctions : defaultEasing(keyframeValues, easingFunctions)
    });
    return {
      calculatedDuration: duration,
      next: (t) => {
        state.value = mapTimeToKeyframe(t);
        state.done = t >= duration;
        return state;
      }
    };
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/drivers/driver-frameloop.mjs
  var frameloopDriver = (update) => {
    const passTimestamp = ({ timestamp }) => update(timestamp);
    return {
      start: () => frame.update(passTimestamp, true),
      stop: () => cancelFrame(passTimestamp),
      /**
       * If we're processing this frame we can use the
       * framelocked timestamp to keep things in sync.
       */
      now: () => frameData.isProcessing ? frameData.timestamp : time.now()
    };
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animators/MainThreadAnimation.mjs
  var generators = {
    decay: inertia,
    inertia,
    tween: keyframes,
    keyframes,
    spring
  };
  var percentToProgress = (percent2) => percent2 / 100;
  var MainThreadAnimation = class extends BaseAnimation {
    constructor(options) {
      super(options);
      this.holdTime = null;
      this.cancelTime = null;
      this.currentTime = 0;
      this.playbackSpeed = 1;
      this.pendingPlayState = "running";
      this.startTime = null;
      this.state = "idle";
      this.stop = () => {
        this.resolver.cancel();
        this.isStopped = true;
        if (this.state === "idle")
          return;
        this.teardown();
        const { onStop } = this.options;
        onStop && onStop();
      };
      const { name, motionValue: motionValue2, element, keyframes: keyframes2 } = this.options;
      const KeyframeResolver$1 = (element === null || element === void 0 ? void 0 : element.KeyframeResolver) || KeyframeResolver;
      const onResolved = (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe);
      this.resolver = new KeyframeResolver$1(keyframes2, onResolved, name, motionValue2, element);
      this.resolver.scheduleResolve();
    }
    flatten() {
      super.flatten();
      if (this._resolved) {
        Object.assign(this._resolved, this.initPlayback(this._resolved.keyframes));
      }
    }
    initPlayback(keyframes$1) {
      const { type = "keyframes", repeat = 0, repeatDelay = 0, repeatType, velocity = 0 } = this.options;
      const generatorFactory = isGenerator(type) ? type : generators[type] || keyframes;
      let mapPercentToKeyframes;
      let mirroredGenerator;
      if (generatorFactory !== keyframes && typeof keyframes$1[0] !== "number") {
        if (true) {
          invariant(keyframes$1.length === 2, `Only two keyframes currently supported with spring and inertia animations. Trying to animate ${keyframes$1}`);
        }
        mapPercentToKeyframes = pipe(percentToProgress, mix(keyframes$1[0], keyframes$1[1]));
        keyframes$1 = [0, 100];
      }
      const generator = generatorFactory({ ...this.options, keyframes: keyframes$1 });
      if (repeatType === "mirror") {
        mirroredGenerator = generatorFactory({
          ...this.options,
          keyframes: [...keyframes$1].reverse(),
          velocity: -velocity
        });
      }
      if (generator.calculatedDuration === null) {
        generator.calculatedDuration = calcGeneratorDuration(generator);
      }
      const { calculatedDuration } = generator;
      const resolvedDuration = calculatedDuration + repeatDelay;
      const totalDuration = resolvedDuration * (repeat + 1) - repeatDelay;
      return {
        generator,
        mirroredGenerator,
        mapPercentToKeyframes,
        calculatedDuration,
        resolvedDuration,
        totalDuration
      };
    }
    onPostResolved() {
      const { autoplay = true } = this.options;
      this.play();
      if (this.pendingPlayState === "paused" || !autoplay) {
        this.pause();
      } else {
        this.state = this.pendingPlayState;
      }
    }
    tick(timestamp, sample = false) {
      const { resolved } = this;
      if (!resolved) {
        const { keyframes: keyframes3 } = this.options;
        return { done: true, value: keyframes3[keyframes3.length - 1] };
      }
      const { finalKeyframe, generator, mirroredGenerator, mapPercentToKeyframes, keyframes: keyframes2, calculatedDuration, totalDuration, resolvedDuration } = resolved;
      if (this.startTime === null)
        return generator.next(0);
      const { delay: delay2, repeat, repeatType, repeatDelay, onUpdate } = this.options;
      if (this.speed > 0) {
        this.startTime = Math.min(this.startTime, timestamp);
      } else if (this.speed < 0) {
        this.startTime = Math.min(timestamp - totalDuration / this.speed, this.startTime);
      }
      if (sample) {
        this.currentTime = timestamp;
      } else if (this.holdTime !== null) {
        this.currentTime = this.holdTime;
      } else {
        this.currentTime = Math.round(timestamp - this.startTime) * this.speed;
      }
      const timeWithoutDelay = this.currentTime - delay2 * (this.speed >= 0 ? 1 : -1);
      const isInDelayPhase = this.speed >= 0 ? timeWithoutDelay < 0 : timeWithoutDelay > totalDuration;
      this.currentTime = Math.max(timeWithoutDelay, 0);
      if (this.state === "finished" && this.holdTime === null) {
        this.currentTime = totalDuration;
      }
      let elapsed = this.currentTime;
      let frameGenerator = generator;
      if (repeat) {
        const progress2 = Math.min(this.currentTime, totalDuration) / resolvedDuration;
        let currentIteration = Math.floor(progress2);
        let iterationProgress = progress2 % 1;
        if (!iterationProgress && progress2 >= 1) {
          iterationProgress = 1;
        }
        iterationProgress === 1 && currentIteration--;
        currentIteration = Math.min(currentIteration, repeat + 1);
        const isOddIteration = Boolean(currentIteration % 2);
        if (isOddIteration) {
          if (repeatType === "reverse") {
            iterationProgress = 1 - iterationProgress;
            if (repeatDelay) {
              iterationProgress -= repeatDelay / resolvedDuration;
            }
          } else if (repeatType === "mirror") {
            frameGenerator = mirroredGenerator;
          }
        }
        elapsed = clamp(0, 1, iterationProgress) * resolvedDuration;
      }
      const state = isInDelayPhase ? { done: false, value: keyframes2[0] } : frameGenerator.next(elapsed);
      if (mapPercentToKeyframes) {
        state.value = mapPercentToKeyframes(state.value);
      }
      let { done } = state;
      if (!isInDelayPhase && calculatedDuration !== null) {
        done = this.speed >= 0 ? this.currentTime >= totalDuration : this.currentTime <= 0;
      }
      const isAnimationFinished = this.holdTime === null && (this.state === "finished" || this.state === "running" && done);
      if (isAnimationFinished && finalKeyframe !== void 0) {
        state.value = getFinalKeyframe(keyframes2, this.options, finalKeyframe);
      }
      if (onUpdate) {
        onUpdate(state.value);
      }
      if (isAnimationFinished) {
        this.finish();
      }
      return state;
    }
    get duration() {
      const { resolved } = this;
      return resolved ? millisecondsToSeconds(resolved.calculatedDuration) : 0;
    }
    get time() {
      return millisecondsToSeconds(this.currentTime);
    }
    set time(newTime) {
      newTime = secondsToMilliseconds(newTime);
      this.currentTime = newTime;
      if (this.holdTime !== null || this.speed === 0) {
        this.holdTime = newTime;
      } else if (this.driver) {
        this.startTime = this.driver.now() - newTime / this.speed;
      }
    }
    get speed() {
      return this.playbackSpeed;
    }
    set speed(newSpeed) {
      const hasChanged = this.playbackSpeed !== newSpeed;
      this.playbackSpeed = newSpeed;
      if (hasChanged) {
        this.time = millisecondsToSeconds(this.currentTime);
      }
    }
    play() {
      if (!this.resolver.isScheduled) {
        this.resolver.resume();
      }
      if (!this._resolved) {
        this.pendingPlayState = "running";
        return;
      }
      if (this.isStopped)
        return;
      const { driver = frameloopDriver, onPlay, startTime } = this.options;
      if (!this.driver) {
        this.driver = driver((timestamp) => this.tick(timestamp));
      }
      onPlay && onPlay();
      const now2 = this.driver.now();
      if (this.holdTime !== null) {
        this.startTime = now2 - this.holdTime;
      } else if (!this.startTime) {
        this.startTime = startTime !== null && startTime !== void 0 ? startTime : this.calcStartTime();
      } else if (this.state === "finished") {
        this.startTime = now2;
      }
      if (this.state === "finished") {
        this.updateFinishedPromise();
      }
      this.cancelTime = this.startTime;
      this.holdTime = null;
      this.state = "running";
      this.driver.start();
    }
    pause() {
      var _a;
      if (!this._resolved) {
        this.pendingPlayState = "paused";
        return;
      }
      this.state = "paused";
      this.holdTime = (_a = this.currentTime) !== null && _a !== void 0 ? _a : 0;
    }
    complete() {
      if (this.state !== "running") {
        this.play();
      }
      this.pendingPlayState = this.state = "finished";
      this.holdTime = null;
    }
    finish() {
      this.teardown();
      this.state = "finished";
      const { onComplete } = this.options;
      onComplete && onComplete();
    }
    cancel() {
      if (this.cancelTime !== null) {
        this.tick(this.cancelTime);
      }
      this.teardown();
      this.updateFinishedPromise();
    }
    teardown() {
      this.state = "idle";
      this.stopDriver();
      this.resolveFinishedPromise();
      this.updateFinishedPromise();
      this.startTime = this.cancelTime = null;
      this.resolver.cancel();
    }
    stopDriver() {
      if (!this.driver)
        return;
      this.driver.stop();
      this.driver = void 0;
    }
    sample(time2) {
      this.startTime = 0;
      return this.tick(time2, true);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animators/utils/accelerated-values.mjs
  var acceleratedValues = /* @__PURE__ */ new Set([
    "opacity",
    "clipPath",
    "filter",
    "transform"
    // TODO: Can be accelerated but currently disabled until https://issues.chromium.org/issues/41491098 is resolved
    // or until we implement support for linear() easing.
    // "background-color"
  ]);

  // ../../../node_modules/framer-motion/dist/es/animation/animators/waapi/index.mjs
  function startWaapiAnimation(element, valueName, keyframes2, { delay: delay2 = 0, duration = 300, repeat = 0, repeatType = "loop", ease: ease2 = "easeInOut", times } = {}) {
    const keyframeOptions = { [valueName]: keyframes2 };
    if (times)
      keyframeOptions.offset = times;
    const easing = mapEasingToNativeEasing(ease2, duration);
    if (Array.isArray(easing))
      keyframeOptions.easing = easing;
    return element.animate(keyframeOptions, {
      delay: delay2,
      duration,
      easing: !Array.isArray(easing) ? easing : "linear",
      fill: "both",
      iterations: repeat + 1,
      direction: repeatType === "reverse" ? "alternate" : "normal"
    });
  }

  // ../../../node_modules/framer-motion/dist/es/animation/animators/waapi/utils/supports-waapi.mjs
  var supportsWaapi = /* @__PURE__ */ memo2(() => Object.hasOwnProperty.call(Element.prototype, "animate"));

  // ../../../node_modules/framer-motion/dist/es/animation/animators/AcceleratedAnimation.mjs
  var sampleDelta = 10;
  var maxDuration = 2e4;
  function requiresPregeneratedKeyframes(options) {
    return isGenerator(options.type) || options.type === "spring" || !isWaapiSupportedEasing(options.ease);
  }
  function pregenerateKeyframes(keyframes2, options) {
    const sampleAnimation = new MainThreadAnimation({
      ...options,
      keyframes: keyframes2,
      repeat: 0,
      delay: 0,
      isGenerator: true
    });
    let state = { done: false, value: keyframes2[0] };
    const pregeneratedKeyframes = [];
    let t = 0;
    while (!state.done && t < maxDuration) {
      state = sampleAnimation.sample(t);
      pregeneratedKeyframes.push(state.value);
      t += sampleDelta;
    }
    return {
      times: void 0,
      keyframes: pregeneratedKeyframes,
      duration: t - sampleDelta,
      ease: "linear"
    };
  }
  var unsupportedEasingFunctions = {
    anticipate,
    backInOut,
    circInOut
  };
  function isUnsupportedEase(key) {
    return key in unsupportedEasingFunctions;
  }
  var AcceleratedAnimation = class extends BaseAnimation {
    constructor(options) {
      super(options);
      const { name, motionValue: motionValue2, element, keyframes: keyframes2 } = this.options;
      this.resolver = new DOMKeyframesResolver(keyframes2, (resolvedKeyframes, finalKeyframe) => this.onKeyframesResolved(resolvedKeyframes, finalKeyframe), name, motionValue2, element);
      this.resolver.scheduleResolve();
    }
    initPlayback(keyframes2, finalKeyframe) {
      let { duration = 300, times, ease: ease2, type, motionValue: motionValue2, name, startTime } = this.options;
      if (!motionValue2.owner || !motionValue2.owner.current) {
        return false;
      }
      if (typeof ease2 === "string" && supportsLinearEasing() && isUnsupportedEase(ease2)) {
        ease2 = unsupportedEasingFunctions[ease2];
      }
      if (requiresPregeneratedKeyframes(this.options)) {
        const { onComplete, onUpdate, motionValue: motionValue3, element, ...options } = this.options;
        const pregeneratedAnimation = pregenerateKeyframes(keyframes2, options);
        keyframes2 = pregeneratedAnimation.keyframes;
        if (keyframes2.length === 1) {
          keyframes2[1] = keyframes2[0];
        }
        duration = pregeneratedAnimation.duration;
        times = pregeneratedAnimation.times;
        ease2 = pregeneratedAnimation.ease;
        type = "keyframes";
      }
      const animation3 = startWaapiAnimation(motionValue2.owner.current, name, keyframes2, { ...this.options, duration, times, ease: ease2 });
      animation3.startTime = startTime !== null && startTime !== void 0 ? startTime : this.calcStartTime();
      if (this.pendingTimeline) {
        attachTimeline(animation3, this.pendingTimeline);
        this.pendingTimeline = void 0;
      } else {
        animation3.onfinish = () => {
          const { onComplete } = this.options;
          motionValue2.set(getFinalKeyframe(keyframes2, this.options, finalKeyframe));
          onComplete && onComplete();
          this.cancel();
          this.resolveFinishedPromise();
        };
      }
      return {
        animation: animation3,
        duration,
        times,
        type,
        ease: ease2,
        keyframes: keyframes2
      };
    }
    get duration() {
      const { resolved } = this;
      if (!resolved)
        return 0;
      const { duration } = resolved;
      return millisecondsToSeconds(duration);
    }
    get time() {
      const { resolved } = this;
      if (!resolved)
        return 0;
      const { animation: animation3 } = resolved;
      return millisecondsToSeconds(animation3.currentTime || 0);
    }
    set time(newTime) {
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      animation3.currentTime = secondsToMilliseconds(newTime);
    }
    get speed() {
      const { resolved } = this;
      if (!resolved)
        return 1;
      const { animation: animation3 } = resolved;
      return animation3.playbackRate;
    }
    set speed(newSpeed) {
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      animation3.playbackRate = newSpeed;
    }
    get state() {
      const { resolved } = this;
      if (!resolved)
        return "idle";
      const { animation: animation3 } = resolved;
      return animation3.playState;
    }
    get startTime() {
      const { resolved } = this;
      if (!resolved)
        return null;
      const { animation: animation3 } = resolved;
      return animation3.startTime;
    }
    /**
     * Replace the default DocumentTimeline with another AnimationTimeline.
     * Currently used for scroll animations.
     */
    attachTimeline(timeline) {
      if (!this._resolved) {
        this.pendingTimeline = timeline;
      } else {
        const { resolved } = this;
        if (!resolved)
          return noop;
        const { animation: animation3 } = resolved;
        attachTimeline(animation3, timeline);
      }
      return noop;
    }
    play() {
      if (this.isStopped)
        return;
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      if (animation3.playState === "finished") {
        this.updateFinishedPromise();
      }
      animation3.play();
    }
    pause() {
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3 } = resolved;
      animation3.pause();
    }
    stop() {
      this.resolver.cancel();
      this.isStopped = true;
      if (this.state === "idle")
        return;
      this.resolveFinishedPromise();
      this.updateFinishedPromise();
      const { resolved } = this;
      if (!resolved)
        return;
      const { animation: animation3, keyframes: keyframes2, duration, type, ease: ease2, times } = resolved;
      if (animation3.playState === "idle" || animation3.playState === "finished") {
        return;
      }
      if (this.time) {
        const { motionValue: motionValue2, onUpdate, onComplete, element, ...options } = this.options;
        const sampleAnimation = new MainThreadAnimation({
          ...options,
          keyframes: keyframes2,
          duration,
          type,
          ease: ease2,
          times,
          isGenerator: true
        });
        const sampleTime = secondsToMilliseconds(this.time);
        motionValue2.setWithVelocity(sampleAnimation.sample(sampleTime - sampleDelta).value, sampleAnimation.sample(sampleTime).value, sampleDelta);
      }
      const { onStop } = this.options;
      onStop && onStop();
      this.cancel();
    }
    complete() {
      const { resolved } = this;
      if (!resolved)
        return;
      resolved.animation.finish();
    }
    cancel() {
      const { resolved } = this;
      if (!resolved)
        return;
      resolved.animation.cancel();
    }
    static supports(options) {
      const { motionValue: motionValue2, name, repeatDelay, repeatType, damping, type } = options;
      if (!motionValue2 || !motionValue2.owner || !(motionValue2.owner.current instanceof HTMLElement)) {
        return false;
      }
      const { onUpdate, transformTemplate } = motionValue2.owner.getProps();
      return supportsWaapi() && name && acceleratedValues.has(name) && /**
       * If we're outputting values to onUpdate then we can't use WAAPI as there's
       * no way to read the value from WAAPI every frame.
       */
      !onUpdate && !transformTemplate && !repeatDelay && repeatType !== "mirror" && damping !== 0 && type !== "inertia";
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/utils/default-transitions.mjs
  var underDampedSpring = {
    type: "spring",
    stiffness: 500,
    damping: 25,
    restSpeed: 10
  };
  var criticallyDampedSpring = (target) => ({
    type: "spring",
    stiffness: 550,
    damping: target === 0 ? 2 * Math.sqrt(550) : 30,
    restSpeed: 10
  });
  var keyframesTransition = {
    type: "keyframes",
    duration: 0.8
  };
  var ease = {
    type: "keyframes",
    ease: [0.25, 0.1, 0.35, 1],
    duration: 0.3
  };
  var getDefaultTransition = (valueKey, { keyframes: keyframes2 }) => {
    if (keyframes2.length > 2) {
      return keyframesTransition;
    } else if (transformProps.has(valueKey)) {
      return valueKey.startsWith("scale") ? criticallyDampedSpring(keyframes2[1]) : underDampedSpring;
    }
    return ease;
  };

  // ../../../node_modules/framer-motion/dist/es/animation/utils/is-transition-defined.mjs
  function isTransitionDefined({ when, delay: _delay, delayChildren, staggerChildren, staggerDirection, repeat, repeatType, repeatDelay, from, elapsed, ...transition }) {
    return !!Object.keys(transition).length;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/motion-value.mjs
  var animateMotionValue = (name, value, target, transition = {}, element, isHandoff) => (onComplete) => {
    const valueTransition = getValueTransition(transition, name) || {};
    const delay2 = valueTransition.delay || transition.delay || 0;
    let { elapsed = 0 } = transition;
    elapsed = elapsed - secondsToMilliseconds(delay2);
    let options = {
      keyframes: Array.isArray(target) ? target : [null, target],
      ease: "easeOut",
      velocity: value.getVelocity(),
      ...valueTransition,
      delay: -elapsed,
      onUpdate: (v) => {
        value.set(v);
        valueTransition.onUpdate && valueTransition.onUpdate(v);
      },
      onComplete: () => {
        onComplete();
        valueTransition.onComplete && valueTransition.onComplete();
      },
      name,
      motionValue: value,
      element: isHandoff ? void 0 : element
    };
    if (!isTransitionDefined(valueTransition)) {
      options = {
        ...options,
        ...getDefaultTransition(name, options)
      };
    }
    if (options.duration) {
      options.duration = secondsToMilliseconds(options.duration);
    }
    if (options.repeatDelay) {
      options.repeatDelay = secondsToMilliseconds(options.repeatDelay);
    }
    if (options.from !== void 0) {
      options.keyframes[0] = options.from;
    }
    let shouldSkip = false;
    if (options.type === false || options.duration === 0 && !options.repeatDelay) {
      options.duration = 0;
      if (options.delay === 0) {
        shouldSkip = true;
      }
    }
    if (instantAnimationState.current || MotionGlobalConfig.skipAnimations) {
      shouldSkip = true;
      options.duration = 0;
      options.delay = 0;
    }
    if (shouldSkip && !isHandoff && value.get() !== void 0) {
      const finalKeyframe = getFinalKeyframe(options.keyframes, valueTransition);
      if (finalKeyframe !== void 0) {
        frame.update(() => {
          options.onUpdate(finalKeyframe);
          options.onComplete();
        });
        return new GroupPlaybackControls([]);
      }
    }
    if (!isHandoff && AcceleratedAnimation.supports(options)) {
      return new AcceleratedAnimation(options);
    } else {
      return new MainThreadAnimation(options);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/visual-element-target.mjs
  function shouldBlockAnimation({ protectedKeys, needsAnimating }, key) {
    const shouldBlock = protectedKeys.hasOwnProperty(key) && needsAnimating[key] !== true;
    needsAnimating[key] = false;
    return shouldBlock;
  }
  function animateTarget(visualElement, targetAndTransition, { delay: delay2 = 0, transitionOverride, type } = {}) {
    var _a;
    let { transition = visualElement.getDefaultTransition(), transitionEnd, ...target } = targetAndTransition;
    if (transitionOverride)
      transition = transitionOverride;
    const animations2 = [];
    const animationTypeState = type && visualElement.animationState && visualElement.animationState.getState()[type];
    for (const key in target) {
      const value = visualElement.getValue(key, (_a = visualElement.latestValues[key]) !== null && _a !== void 0 ? _a : null);
      const valueTarget = target[key];
      if (valueTarget === void 0 || animationTypeState && shouldBlockAnimation(animationTypeState, key)) {
        continue;
      }
      const valueTransition = {
        delay: delay2,
        ...getValueTransition(transition || {}, key)
      };
      let isHandoff = false;
      if (window.MotionHandoffAnimation) {
        const appearId = getOptimisedAppearId(visualElement);
        if (appearId) {
          const startTime = window.MotionHandoffAnimation(appearId, key, frame);
          if (startTime !== null) {
            valueTransition.startTime = startTime;
            isHandoff = true;
          }
        }
      }
      addValueToWillChange(visualElement, key);
      value.start(animateMotionValue(key, value, valueTarget, visualElement.shouldReduceMotion && positionalKeys.has(key) ? { type: false } : valueTransition, visualElement, isHandoff));
      const animation3 = value.animation;
      if (animation3) {
        animations2.push(animation3);
      }
    }
    if (transitionEnd) {
      Promise.all(animations2).then(() => {
        frame.update(() => {
          transitionEnd && setTarget(visualElement, transitionEnd);
        });
      });
    }
    return animations2;
  }

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/visual-element-variant.mjs
  function animateVariant(visualElement, variant, options = {}) {
    var _a;
    const resolved = resolveVariant(visualElement, variant, options.type === "exit" ? (_a = visualElement.presenceContext) === null || _a === void 0 ? void 0 : _a.custom : void 0);
    let { transition = visualElement.getDefaultTransition() || {} } = resolved || {};
    if (options.transitionOverride) {
      transition = options.transitionOverride;
    }
    const getAnimation = resolved ? () => Promise.all(animateTarget(visualElement, resolved, options)) : () => Promise.resolve();
    const getChildAnimations = visualElement.variantChildren && visualElement.variantChildren.size ? (forwardDelay = 0) => {
      const { delayChildren = 0, staggerChildren, staggerDirection } = transition;
      return animateChildren(visualElement, variant, delayChildren + forwardDelay, staggerChildren, staggerDirection, options);
    } : () => Promise.resolve();
    const { when } = transition;
    if (when) {
      const [first, last] = when === "beforeChildren" ? [getAnimation, getChildAnimations] : [getChildAnimations, getAnimation];
      return first().then(() => last());
    } else {
      return Promise.all([getAnimation(), getChildAnimations(options.delay)]);
    }
  }
  function animateChildren(visualElement, variant, delayChildren = 0, staggerChildren = 0, staggerDirection = 1, options) {
    const animations2 = [];
    const maxStaggerDuration = (visualElement.variantChildren.size - 1) * staggerChildren;
    const generateStaggerDuration = staggerDirection === 1 ? (i = 0) => i * staggerChildren : (i = 0) => maxStaggerDuration - i * staggerChildren;
    Array.from(visualElement.variantChildren).sort(sortByTreeOrder).forEach((child, i) => {
      child.notify("AnimationStart", variant);
      animations2.push(animateVariant(child, variant, {
        ...options,
        delay: delayChildren + generateStaggerDuration(i)
      }).then(() => child.notify("AnimationComplete", variant)));
    });
    return Promise.all(animations2);
  }
  function sortByTreeOrder(a, b) {
    return a.sortNodePosition(b);
  }

  // ../../../node_modules/framer-motion/dist/es/animation/interfaces/visual-element.mjs
  function animateVisualElement(visualElement, definition, options = {}) {
    visualElement.notify("AnimationStart", definition);
    let animation3;
    if (Array.isArray(definition)) {
      const animations2 = definition.map((variant) => animateVariant(visualElement, variant, options));
      animation3 = Promise.all(animations2);
    } else if (typeof definition === "string") {
      animation3 = animateVariant(visualElement, definition, options);
    } else {
      const resolvedDefinition = typeof definition === "function" ? resolveVariant(visualElement, definition, options.custom) : definition;
      animation3 = Promise.all(animateTarget(visualElement, resolvedDefinition, options));
    }
    return animation3.then(() => {
      visualElement.notify("AnimationComplete", definition);
    });
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/get-variant-context.mjs
  var numVariantProps = variantProps.length;
  function getVariantContext(visualElement) {
    if (!visualElement)
      return void 0;
    if (!visualElement.isControllingVariants) {
      const context2 = visualElement.parent ? getVariantContext(visualElement.parent) || {} : {};
      if (visualElement.props.initial !== void 0) {
        context2.initial = visualElement.props.initial;
      }
      return context2;
    }
    const context = {};
    for (let i = 0; i < numVariantProps; i++) {
      const name = variantProps[i];
      const prop = visualElement.props[name];
      if (isVariantLabel(prop) || prop === false) {
        context[name] = prop;
      }
    }
    return context;
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/animation-state.mjs
  var reversePriorityOrder = [...variantPriorityOrder].reverse();
  var numAnimationTypes = variantPriorityOrder.length;
  function animateList(visualElement) {
    return (animations2) => Promise.all(animations2.map(({ animation: animation3, options }) => animateVisualElement(visualElement, animation3, options)));
  }
  function createAnimationState(visualElement) {
    let animate = animateList(visualElement);
    let state = createState();
    let isInitialRender = true;
    const buildResolvedTypeValues = (type) => (acc, definition) => {
      var _a;
      const resolved = resolveVariant(visualElement, definition, type === "exit" ? (_a = visualElement.presenceContext) === null || _a === void 0 ? void 0 : _a.custom : void 0);
      if (resolved) {
        const { transition, transitionEnd, ...target } = resolved;
        acc = { ...acc, ...target, ...transitionEnd };
      }
      return acc;
    };
    function setAnimateFunction(makeAnimator) {
      animate = makeAnimator(visualElement);
    }
    function animateChanges(changedActiveType) {
      const { props } = visualElement;
      const context = getVariantContext(visualElement.parent) || {};
      const animations2 = [];
      const removedKeys = /* @__PURE__ */ new Set();
      let encounteredKeys = {};
      let removedVariantIndex = Infinity;
      for (let i = 0; i < numAnimationTypes; i++) {
        const type = reversePriorityOrder[i];
        const typeState = state[type];
        const prop = props[type] !== void 0 ? props[type] : context[type];
        const propIsVariant = isVariantLabel(prop);
        const activeDelta = type === changedActiveType ? typeState.isActive : null;
        if (activeDelta === false)
          removedVariantIndex = i;
        let isInherited = prop === context[type] && prop !== props[type] && propIsVariant;
        if (isInherited && isInitialRender && visualElement.manuallyAnimateOnMount) {
          isInherited = false;
        }
        typeState.protectedKeys = { ...encounteredKeys };
        if (
          // If it isn't active and hasn't *just* been set as inactive
          !typeState.isActive && activeDelta === null || // If we didn't and don't have any defined prop for this animation type
          !prop && !typeState.prevProp || // Or if the prop doesn't define an animation
          isAnimationControls(prop) || typeof prop === "boolean"
        ) {
          continue;
        }
        const variantDidChange = checkVariantsDidChange(typeState.prevProp, prop);
        let shouldAnimateType = variantDidChange || // If we're making this variant active, we want to always make it active
        type === changedActiveType && typeState.isActive && !isInherited && propIsVariant || // If we removed a higher-priority variant (i is in reverse order)
        i > removedVariantIndex && propIsVariant;
        let handledRemovedValues = false;
        const definitionList = Array.isArray(prop) ? prop : [prop];
        let resolvedValues = definitionList.reduce(buildResolvedTypeValues(type), {});
        if (activeDelta === false)
          resolvedValues = {};
        const { prevResolvedValues = {} } = typeState;
        const allKeys = {
          ...prevResolvedValues,
          ...resolvedValues
        };
        const markToAnimate = (key) => {
          shouldAnimateType = true;
          if (removedKeys.has(key)) {
            handledRemovedValues = true;
            removedKeys.delete(key);
          }
          typeState.needsAnimating[key] = true;
          const motionValue2 = visualElement.getValue(key);
          if (motionValue2)
            motionValue2.liveStyle = false;
        };
        for (const key in allKeys) {
          const next = resolvedValues[key];
          const prev = prevResolvedValues[key];
          if (encounteredKeys.hasOwnProperty(key))
            continue;
          let valueHasChanged = false;
          if (isKeyframesTarget(next) && isKeyframesTarget(prev)) {
            valueHasChanged = !shallowCompare(next, prev);
          } else {
            valueHasChanged = next !== prev;
          }
          if (valueHasChanged) {
            if (next !== void 0 && next !== null) {
              markToAnimate(key);
            } else {
              removedKeys.add(key);
            }
          } else if (next !== void 0 && removedKeys.has(key)) {
            markToAnimate(key);
          } else {
            typeState.protectedKeys[key] = true;
          }
        }
        typeState.prevProp = prop;
        typeState.prevResolvedValues = resolvedValues;
        if (typeState.isActive) {
          encounteredKeys = { ...encounteredKeys, ...resolvedValues };
        }
        if (isInitialRender && visualElement.blockInitialAnimation) {
          shouldAnimateType = false;
        }
        const willAnimateViaParent = isInherited && variantDidChange;
        const needsAnimating = !willAnimateViaParent || handledRemovedValues;
        if (shouldAnimateType && needsAnimating) {
          animations2.push(...definitionList.map((animation3) => ({
            animation: animation3,
            options: { type }
          })));
        }
      }
      if (removedKeys.size) {
        const fallbackAnimation = {};
        removedKeys.forEach((key) => {
          const fallbackTarget = visualElement.getBaseTarget(key);
          const motionValue2 = visualElement.getValue(key);
          if (motionValue2)
            motionValue2.liveStyle = true;
          fallbackAnimation[key] = fallbackTarget !== null && fallbackTarget !== void 0 ? fallbackTarget : null;
        });
        animations2.push({ animation: fallbackAnimation });
      }
      let shouldAnimate = Boolean(animations2.length);
      if (isInitialRender && (props.initial === false || props.initial === props.animate) && !visualElement.manuallyAnimateOnMount) {
        shouldAnimate = false;
      }
      isInitialRender = false;
      return shouldAnimate ? animate(animations2) : Promise.resolve();
    }
    function setActive(type, isActive) {
      var _a;
      if (state[type].isActive === isActive)
        return Promise.resolve();
      (_a = visualElement.variantChildren) === null || _a === void 0 ? void 0 : _a.forEach((child) => {
        var _a2;
        return (_a2 = child.animationState) === null || _a2 === void 0 ? void 0 : _a2.setActive(type, isActive);
      });
      state[type].isActive = isActive;
      const animations2 = animateChanges(type);
      for (const key in state) {
        state[key].protectedKeys = {};
      }
      return animations2;
    }
    return {
      animateChanges,
      setActive,
      setAnimateFunction,
      getState: () => state,
      reset: () => {
        state = createState();
        isInitialRender = true;
      }
    };
  }
  function checkVariantsDidChange(prev, next) {
    if (typeof next === "string") {
      return next !== prev;
    } else if (Array.isArray(next)) {
      return !shallowCompare(next, prev);
    }
    return false;
  }
  function createTypeState(isActive = false) {
    return {
      isActive,
      protectedKeys: {},
      needsAnimating: {},
      prevResolvedValues: {}
    };
  }
  function createState() {
    return {
      animate: createTypeState(true),
      whileInView: createTypeState(),
      whileHover: createTypeState(),
      whileTap: createTypeState(),
      whileDrag: createTypeState(),
      whileFocus: createTypeState(),
      exit: createTypeState()
    };
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/Feature.mjs
  var Feature = class {
    constructor(node) {
      this.isMounted = false;
      this.node = node;
    }
    update() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/animation/index.mjs
  var AnimationFeature = class extends Feature {
    /**
     * We dynamically generate the AnimationState manager as it contains a reference
     * to the underlying animation library. We only want to load that if we load this,
     * so people can optionally code split it out using the `m` component.
     */
    constructor(node) {
      super(node);
      node.animationState || (node.animationState = createAnimationState(node));
    }
    updateAnimationControlsSubscription() {
      const { animate } = this.node.getProps();
      if (isAnimationControls(animate)) {
        this.unmountControls = animate.subscribe(this.node);
      }
    }
    /**
     * Subscribe any provided AnimationControls to the component's VisualElement
     */
    mount() {
      this.updateAnimationControlsSubscription();
    }
    update() {
      const { animate } = this.node.getProps();
      const { animate: prevAnimate } = this.node.prevProps || {};
      if (animate !== prevAnimate) {
        this.updateAnimationControlsSubscription();
      }
    }
    unmount() {
      var _a;
      this.node.animationState.reset();
      (_a = this.unmountControls) === null || _a === void 0 ? void 0 : _a.call(this);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/animation/exit.mjs
  var id = 0;
  var ExitAnimationFeature = class extends Feature {
    constructor() {
      super(...arguments);
      this.id = id++;
    }
    update() {
      if (!this.node.presenceContext)
        return;
      const { isPresent, onExitComplete } = this.node.presenceContext;
      const { isPresent: prevIsPresent } = this.node.prevPresenceContext || {};
      if (!this.node.animationState || isPresent === prevIsPresent) {
        return;
      }
      const exitAnimation = this.node.animationState.setActive("exit", !isPresent);
      if (onExitComplete && !isPresent) {
        exitAnimation.then(() => onExitComplete(this.id));
      }
    }
    mount() {
      const { register } = this.node.presenceContext || {};
      if (register) {
        this.unmount = register(this.id);
      }
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/animations.mjs
  var animations = {
    animation: {
      Feature: AnimationFeature
    },
    exit: {
      Feature: ExitAnimationFeature
    }
  };

  // ../../../node_modules/framer-motion/dist/es/events/add-dom-event.mjs
  function addDomEvent(target, eventName, handler, options = { passive: true }) {
    target.addEventListener(eventName, handler, options);
    return () => target.removeEventListener(eventName, handler);
  }

  // ../../../node_modules/framer-motion/dist/es/events/event-info.mjs
  function extractEventInfo(event) {
    return {
      point: {
        x: event.pageX,
        y: event.pageY
      }
    };
  }
  var addPointerInfo = (handler) => {
    return (event) => isPrimaryPointer(event) && handler(event, extractEventInfo(event));
  };

  // ../../../node_modules/framer-motion/dist/es/events/add-pointer-event.mjs
  function addPointerEvent(target, eventName, handler, options) {
    return addDomEvent(target, eventName, addPointerInfo(handler), options);
  }

  // ../../../node_modules/framer-motion/dist/es/utils/distance.mjs
  var distance = (a, b) => Math.abs(a - b);
  function distance2D(a, b) {
    const xDelta = distance(a.x, b.x);
    const yDelta = distance(a.y, b.y);
    return Math.sqrt(xDelta ** 2 + yDelta ** 2);
  }

  // ../../../node_modules/framer-motion/dist/es/gestures/pan/PanSession.mjs
  var PanSession = class {
    constructor(event, handlers, { transformPagePoint, contextWindow, dragSnapToOrigin = false } = {}) {
      this.startEvent = null;
      this.lastMoveEvent = null;
      this.lastMoveEventInfo = null;
      this.handlers = {};
      this.contextWindow = window;
      this.updatePoint = () => {
        if (!(this.lastMoveEvent && this.lastMoveEventInfo))
          return;
        const info2 = getPanInfo(this.lastMoveEventInfo, this.history);
        const isPanStarted = this.startEvent !== null;
        const isDistancePastThreshold = distance2D(info2.offset, { x: 0, y: 0 }) >= 3;
        if (!isPanStarted && !isDistancePastThreshold)
          return;
        const { point: point2 } = info2;
        const { timestamp: timestamp2 } = frameData;
        this.history.push({ ...point2, timestamp: timestamp2 });
        const { onStart, onMove } = this.handlers;
        if (!isPanStarted) {
          onStart && onStart(this.lastMoveEvent, info2);
          this.startEvent = this.lastMoveEvent;
        }
        onMove && onMove(this.lastMoveEvent, info2);
      };
      this.handlePointerMove = (event2, info2) => {
        this.lastMoveEvent = event2;
        this.lastMoveEventInfo = transformPoint(info2, this.transformPagePoint);
        frame.update(this.updatePoint, true);
      };
      this.handlePointerUp = (event2, info2) => {
        this.end();
        const { onEnd, onSessionEnd, resumeAnimation } = this.handlers;
        if (this.dragSnapToOrigin)
          resumeAnimation && resumeAnimation();
        if (!(this.lastMoveEvent && this.lastMoveEventInfo))
          return;
        const panInfo = getPanInfo(event2.type === "pointercancel" ? this.lastMoveEventInfo : transformPoint(info2, this.transformPagePoint), this.history);
        if (this.startEvent && onEnd) {
          onEnd(event2, panInfo);
        }
        onSessionEnd && onSessionEnd(event2, panInfo);
      };
      if (!isPrimaryPointer(event))
        return;
      this.dragSnapToOrigin = dragSnapToOrigin;
      this.handlers = handlers;
      this.transformPagePoint = transformPagePoint;
      this.contextWindow = contextWindow || window;
      const info = extractEventInfo(event);
      const initialInfo = transformPoint(info, this.transformPagePoint);
      const { point } = initialInfo;
      const { timestamp } = frameData;
      this.history = [{ ...point, timestamp }];
      const { onSessionStart } = handlers;
      onSessionStart && onSessionStart(event, getPanInfo(initialInfo, this.history));
      this.removeListeners = pipe(addPointerEvent(this.contextWindow, "pointermove", this.handlePointerMove), addPointerEvent(this.contextWindow, "pointerup", this.handlePointerUp), addPointerEvent(this.contextWindow, "pointercancel", this.handlePointerUp));
    }
    updateHandlers(handlers) {
      this.handlers = handlers;
    }
    end() {
      this.removeListeners && this.removeListeners();
      cancelFrame(this.updatePoint);
    }
  };
  function transformPoint(info, transformPagePoint) {
    return transformPagePoint ? { point: transformPagePoint(info.point) } : info;
  }
  function subtractPoint(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }
  function getPanInfo({ point }, history) {
    return {
      point,
      delta: subtractPoint(point, lastDevicePoint(history)),
      offset: subtractPoint(point, startDevicePoint(history)),
      velocity: getVelocity(history, 0.1)
    };
  }
  function startDevicePoint(history) {
    return history[0];
  }
  function lastDevicePoint(history) {
    return history[history.length - 1];
  }
  function getVelocity(history, timeDelta) {
    if (history.length < 2) {
      return { x: 0, y: 0 };
    }
    let i = history.length - 1;
    let timestampedPoint = null;
    const lastPoint = lastDevicePoint(history);
    while (i >= 0) {
      timestampedPoint = history[i];
      if (lastPoint.timestamp - timestampedPoint.timestamp > secondsToMilliseconds(timeDelta)) {
        break;
      }
      i--;
    }
    if (!timestampedPoint) {
      return { x: 0, y: 0 };
    }
    const time2 = millisecondsToSeconds(lastPoint.timestamp - timestampedPoint.timestamp);
    if (time2 === 0) {
      return { x: 0, y: 0 };
    }
    const currentVelocity = {
      x: (lastPoint.x - timestampedPoint.x) / time2,
      y: (lastPoint.y - timestampedPoint.y) / time2
    };
    if (currentVelocity.x === Infinity) {
      currentVelocity.x = 0;
    }
    if (currentVelocity.y === Infinity) {
      currentVelocity.y = 0;
    }
    return currentVelocity;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/delta-calc.mjs
  var SCALE_PRECISION = 1e-4;
  var SCALE_MIN = 1 - SCALE_PRECISION;
  var SCALE_MAX = 1 + SCALE_PRECISION;
  var TRANSLATE_PRECISION = 0.01;
  var TRANSLATE_MIN = 0 - TRANSLATE_PRECISION;
  var TRANSLATE_MAX = 0 + TRANSLATE_PRECISION;
  function calcLength(axis) {
    return axis.max - axis.min;
  }
  function isNear(value, target, maxDistance) {
    return Math.abs(value - target) <= maxDistance;
  }
  function calcAxisDelta(delta, source, target, origin = 0.5) {
    delta.origin = origin;
    delta.originPoint = mixNumber(source.min, source.max, delta.origin);
    delta.scale = calcLength(target) / calcLength(source);
    delta.translate = mixNumber(target.min, target.max, delta.origin) - delta.originPoint;
    if (delta.scale >= SCALE_MIN && delta.scale <= SCALE_MAX || isNaN(delta.scale)) {
      delta.scale = 1;
    }
    if (delta.translate >= TRANSLATE_MIN && delta.translate <= TRANSLATE_MAX || isNaN(delta.translate)) {
      delta.translate = 0;
    }
  }
  function calcBoxDelta(delta, source, target, origin) {
    calcAxisDelta(delta.x, source.x, target.x, origin ? origin.originX : void 0);
    calcAxisDelta(delta.y, source.y, target.y, origin ? origin.originY : void 0);
  }
  function calcRelativeAxis(target, relative, parent) {
    target.min = parent.min + relative.min;
    target.max = target.min + calcLength(relative);
  }
  function calcRelativeBox(target, relative, parent) {
    calcRelativeAxis(target.x, relative.x, parent.x);
    calcRelativeAxis(target.y, relative.y, parent.y);
  }
  function calcRelativeAxisPosition(target, layout2, parent) {
    target.min = layout2.min - parent.min;
    target.max = target.min + calcLength(layout2);
  }
  function calcRelativePosition(target, layout2, parent) {
    calcRelativeAxisPosition(target.x, layout2.x, parent.x);
    calcRelativeAxisPosition(target.y, layout2.y, parent.y);
  }

  // ../../../node_modules/framer-motion/dist/es/gestures/drag/utils/constraints.mjs
  function applyConstraints(point, { min, max }, elastic) {
    if (min !== void 0 && point < min) {
      point = elastic ? mixNumber(min, point, elastic.min) : Math.max(point, min);
    } else if (max !== void 0 && point > max) {
      point = elastic ? mixNumber(max, point, elastic.max) : Math.min(point, max);
    }
    return point;
  }
  function calcRelativeAxisConstraints(axis, min, max) {
    return {
      min: min !== void 0 ? axis.min + min : void 0,
      max: max !== void 0 ? axis.max + max - (axis.max - axis.min) : void 0
    };
  }
  function calcRelativeConstraints(layoutBox, { top, left, bottom, right }) {
    return {
      x: calcRelativeAxisConstraints(layoutBox.x, left, right),
      y: calcRelativeAxisConstraints(layoutBox.y, top, bottom)
    };
  }
  function calcViewportAxisConstraints(layoutAxis, constraintsAxis) {
    let min = constraintsAxis.min - layoutAxis.min;
    let max = constraintsAxis.max - layoutAxis.max;
    if (constraintsAxis.max - constraintsAxis.min < layoutAxis.max - layoutAxis.min) {
      [min, max] = [max, min];
    }
    return { min, max };
  }
  function calcViewportConstraints(layoutBox, constraintsBox) {
    return {
      x: calcViewportAxisConstraints(layoutBox.x, constraintsBox.x),
      y: calcViewportAxisConstraints(layoutBox.y, constraintsBox.y)
    };
  }
  function calcOrigin2(source, target) {
    let origin = 0.5;
    const sourceLength = calcLength(source);
    const targetLength = calcLength(target);
    if (targetLength > sourceLength) {
      origin = progress(target.min, target.max - sourceLength, source.min);
    } else if (sourceLength > targetLength) {
      origin = progress(source.min, source.max - targetLength, target.min);
    }
    return clamp(0, 1, origin);
  }
  function rebaseAxisConstraints(layout2, constraints) {
    const relativeConstraints = {};
    if (constraints.min !== void 0) {
      relativeConstraints.min = constraints.min - layout2.min;
    }
    if (constraints.max !== void 0) {
      relativeConstraints.max = constraints.max - layout2.min;
    }
    return relativeConstraints;
  }
  var defaultElastic = 0.35;
  function resolveDragElastic(dragElastic = defaultElastic) {
    if (dragElastic === false) {
      dragElastic = 0;
    } else if (dragElastic === true) {
      dragElastic = defaultElastic;
    }
    return {
      x: resolveAxisElastic(dragElastic, "left", "right"),
      y: resolveAxisElastic(dragElastic, "top", "bottom")
    };
  }
  function resolveAxisElastic(dragElastic, minLabel, maxLabel) {
    return {
      min: resolvePointElastic(dragElastic, minLabel),
      max: resolvePointElastic(dragElastic, maxLabel)
    };
  }
  function resolvePointElastic(dragElastic, label) {
    return typeof dragElastic === "number" ? dragElastic : dragElastic[label] || 0;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/models.mjs
  var createAxisDelta = () => ({
    translate: 0,
    scale: 1,
    origin: 0,
    originPoint: 0
  });
  var createDelta = () => ({
    x: createAxisDelta(),
    y: createAxisDelta()
  });
  var createAxis = () => ({ min: 0, max: 0 });
  var createBox = () => ({
    x: createAxis(),
    y: createAxis()
  });

  // ../../../node_modules/framer-motion/dist/es/projection/utils/each-axis.mjs
  function eachAxis(callback) {
    return [callback("x"), callback("y")];
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/conversion.mjs
  function convertBoundingBoxToBox({ top, left, right, bottom }) {
    return {
      x: { min: left, max: right },
      y: { min: top, max: bottom }
    };
  }
  function convertBoxToBoundingBox({ x, y }) {
    return { top: y.min, right: x.max, bottom: y.max, left: x.min };
  }
  function transformBoxPoints(point, transformPoint2) {
    if (!transformPoint2)
      return point;
    const topLeft = transformPoint2({ x: point.left, y: point.top });
    const bottomRight = transformPoint2({ x: point.right, y: point.bottom });
    return {
      top: topLeft.y,
      left: topLeft.x,
      bottom: bottomRight.y,
      right: bottomRight.x
    };
  }

  // ../../../node_modules/framer-motion/dist/es/projection/utils/has-transform.mjs
  function isIdentityScale(scale2) {
    return scale2 === void 0 || scale2 === 1;
  }
  function hasScale({ scale: scale2, scaleX, scaleY }) {
    return !isIdentityScale(scale2) || !isIdentityScale(scaleX) || !isIdentityScale(scaleY);
  }
  function hasTransform(values) {
    return hasScale(values) || has2DTranslate(values) || values.z || values.rotate || values.rotateX || values.rotateY || values.skewX || values.skewY;
  }
  function has2DTranslate(values) {
    return is2DTranslate(values.x) || is2DTranslate(values.y);
  }
  function is2DTranslate(value) {
    return value && value !== "0%";
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/delta-apply.mjs
  function scalePoint(point, scale2, originPoint) {
    const distanceFromOrigin = point - originPoint;
    const scaled = scale2 * distanceFromOrigin;
    return originPoint + scaled;
  }
  function applyPointDelta(point, translate, scale2, originPoint, boxScale) {
    if (boxScale !== void 0) {
      point = scalePoint(point, boxScale, originPoint);
    }
    return scalePoint(point, scale2, originPoint) + translate;
  }
  function applyAxisDelta(axis, translate = 0, scale2 = 1, originPoint, boxScale) {
    axis.min = applyPointDelta(axis.min, translate, scale2, originPoint, boxScale);
    axis.max = applyPointDelta(axis.max, translate, scale2, originPoint, boxScale);
  }
  function applyBoxDelta(box, { x, y }) {
    applyAxisDelta(box.x, x.translate, x.scale, x.originPoint);
    applyAxisDelta(box.y, y.translate, y.scale, y.originPoint);
  }
  var TREE_SCALE_SNAP_MIN = 0.999999999999;
  var TREE_SCALE_SNAP_MAX = 1.0000000000001;
  function applyTreeDeltas(box, treeScale, treePath, isSharedTransition = false) {
    const treeLength = treePath.length;
    if (!treeLength)
      return;
    treeScale.x = treeScale.y = 1;
    let node;
    let delta;
    for (let i = 0; i < treeLength; i++) {
      node = treePath[i];
      delta = node.projectionDelta;
      const { visualElement } = node.options;
      if (visualElement && visualElement.props.style && visualElement.props.style.display === "contents") {
        continue;
      }
      if (isSharedTransition && node.options.layoutScroll && node.scroll && node !== node.root) {
        transformBox(box, {
          x: -node.scroll.offset.x,
          y: -node.scroll.offset.y
        });
      }
      if (delta) {
        treeScale.x *= delta.x.scale;
        treeScale.y *= delta.y.scale;
        applyBoxDelta(box, delta);
      }
      if (isSharedTransition && hasTransform(node.latestValues)) {
        transformBox(box, node.latestValues);
      }
    }
    if (treeScale.x < TREE_SCALE_SNAP_MAX && treeScale.x > TREE_SCALE_SNAP_MIN) {
      treeScale.x = 1;
    }
    if (treeScale.y < TREE_SCALE_SNAP_MAX && treeScale.y > TREE_SCALE_SNAP_MIN) {
      treeScale.y = 1;
    }
  }
  function translateAxis(axis, distance2) {
    axis.min = axis.min + distance2;
    axis.max = axis.max + distance2;
  }
  function transformAxis(axis, axisTranslate, axisScale, boxScale, axisOrigin = 0.5) {
    const originPoint = mixNumber(axis.min, axis.max, axisOrigin);
    applyAxisDelta(axis, axisTranslate, axisScale, originPoint, boxScale);
  }
  function transformBox(box, transform) {
    transformAxis(box.x, transform.x, transform.scaleX, transform.scale, transform.originX);
    transformAxis(box.y, transform.y, transform.scaleY, transform.scale, transform.originY);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/utils/measure.mjs
  function measureViewportBox(instance, transformPoint2) {
    return convertBoundingBoxToBox(transformBoxPoints(instance.getBoundingClientRect(), transformPoint2));
  }
  function measurePageBox(element, rootProjectionNode2, transformPagePoint) {
    const viewportBox = measureViewportBox(element, transformPagePoint);
    const { scroll } = rootProjectionNode2;
    if (scroll) {
      translateAxis(viewportBox.x, scroll.offset.x);
      translateAxis(viewportBox.y, scroll.offset.y);
    }
    return viewportBox;
  }

  // ../../../node_modules/framer-motion/dist/es/utils/get-context-window.mjs
  var getContextWindow = ({ current }) => {
    return current ? current.ownerDocument.defaultView : null;
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/drag/VisualElementDragControls.mjs
  var elementDragControls = /* @__PURE__ */ new WeakMap();
  var VisualElementDragControls = class {
    constructor(visualElement) {
      this.openDragLock = null;
      this.isDragging = false;
      this.currentDirection = null;
      this.originPoint = { x: 0, y: 0 };
      this.constraints = false;
      this.hasMutatedConstraints = false;
      this.elastic = createBox();
      this.visualElement = visualElement;
    }
    start(originEvent, { snapToCursor = false } = {}) {
      const { presenceContext } = this.visualElement;
      if (presenceContext && presenceContext.isPresent === false)
        return;
      const onSessionStart = (event) => {
        const { dragSnapToOrigin: dragSnapToOrigin2 } = this.getProps();
        dragSnapToOrigin2 ? this.pauseAnimation() : this.stopAnimation();
        if (snapToCursor) {
          this.snapToCursor(extractEventInfo(event).point);
        }
      };
      const onStart = (event, info) => {
        const { drag: drag2, dragPropagation, onDragStart } = this.getProps();
        if (drag2 && !dragPropagation) {
          if (this.openDragLock)
            this.openDragLock();
          this.openDragLock = setDragLock(drag2);
          if (!this.openDragLock)
            return;
        }
        this.isDragging = true;
        this.currentDirection = null;
        this.resolveConstraints();
        if (this.visualElement.projection) {
          this.visualElement.projection.isAnimationBlocked = true;
          this.visualElement.projection.target = void 0;
        }
        eachAxis((axis) => {
          let current = this.getAxisMotionValue(axis).get() || 0;
          if (percent.test(current)) {
            const { projection } = this.visualElement;
            if (projection && projection.layout) {
              const measuredAxis = projection.layout.layoutBox[axis];
              if (measuredAxis) {
                const length = calcLength(measuredAxis);
                current = length * (parseFloat(current) / 100);
              }
            }
          }
          this.originPoint[axis] = current;
        });
        if (onDragStart) {
          frame.postRender(() => onDragStart(event, info));
        }
        addValueToWillChange(this.visualElement, "transform");
        const { animationState } = this.visualElement;
        animationState && animationState.setActive("whileDrag", true);
      };
      const onMove = (event, info) => {
        const { dragPropagation, dragDirectionLock, onDirectionLock, onDrag } = this.getProps();
        if (!dragPropagation && !this.openDragLock)
          return;
        const { offset } = info;
        if (dragDirectionLock && this.currentDirection === null) {
          this.currentDirection = getCurrentDirection(offset);
          if (this.currentDirection !== null) {
            onDirectionLock && onDirectionLock(this.currentDirection);
          }
          return;
        }
        this.updateAxis("x", info.point, offset);
        this.updateAxis("y", info.point, offset);
        this.visualElement.render();
        onDrag && onDrag(event, info);
      };
      const onSessionEnd = (event, info) => this.stop(event, info);
      const resumeAnimation = () => eachAxis((axis) => {
        var _a;
        return this.getAnimationState(axis) === "paused" && ((_a = this.getAxisMotionValue(axis).animation) === null || _a === void 0 ? void 0 : _a.play());
      });
      const { dragSnapToOrigin } = this.getProps();
      this.panSession = new PanSession(originEvent, {
        onSessionStart,
        onStart,
        onMove,
        onSessionEnd,
        resumeAnimation
      }, {
        transformPagePoint: this.visualElement.getTransformPagePoint(),
        dragSnapToOrigin,
        contextWindow: getContextWindow(this.visualElement)
      });
    }
    stop(event, info) {
      const isDragging2 = this.isDragging;
      this.cancel();
      if (!isDragging2)
        return;
      const { velocity } = info;
      this.startAnimation(velocity);
      const { onDragEnd } = this.getProps();
      if (onDragEnd) {
        frame.postRender(() => onDragEnd(event, info));
      }
    }
    cancel() {
      this.isDragging = false;
      const { projection, animationState } = this.visualElement;
      if (projection) {
        projection.isAnimationBlocked = false;
      }
      this.panSession && this.panSession.end();
      this.panSession = void 0;
      const { dragPropagation } = this.getProps();
      if (!dragPropagation && this.openDragLock) {
        this.openDragLock();
        this.openDragLock = null;
      }
      animationState && animationState.setActive("whileDrag", false);
    }
    updateAxis(axis, _point, offset) {
      const { drag: drag2 } = this.getProps();
      if (!offset || !shouldDrag(axis, drag2, this.currentDirection))
        return;
      const axisValue = this.getAxisMotionValue(axis);
      let next = this.originPoint[axis] + offset[axis];
      if (this.constraints && this.constraints[axis]) {
        next = applyConstraints(next, this.constraints[axis], this.elastic[axis]);
      }
      axisValue.set(next);
    }
    resolveConstraints() {
      var _a;
      const { dragConstraints, dragElastic } = this.getProps();
      const layout2 = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(false) : (_a = this.visualElement.projection) === null || _a === void 0 ? void 0 : _a.layout;
      const prevConstraints = this.constraints;
      if (dragConstraints && isRefObject(dragConstraints)) {
        if (!this.constraints) {
          this.constraints = this.resolveRefConstraints();
        }
      } else {
        if (dragConstraints && layout2) {
          this.constraints = calcRelativeConstraints(layout2.layoutBox, dragConstraints);
        } else {
          this.constraints = false;
        }
      }
      this.elastic = resolveDragElastic(dragElastic);
      if (prevConstraints !== this.constraints && layout2 && this.constraints && !this.hasMutatedConstraints) {
        eachAxis((axis) => {
          if (this.constraints !== false && this.getAxisMotionValue(axis)) {
            this.constraints[axis] = rebaseAxisConstraints(layout2.layoutBox[axis], this.constraints[axis]);
          }
        });
      }
    }
    resolveRefConstraints() {
      const { dragConstraints: constraints, onMeasureDragConstraints } = this.getProps();
      if (!constraints || !isRefObject(constraints))
        return false;
      const constraintsElement = constraints.current;
      invariant(constraintsElement !== null, "If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop.");
      const { projection } = this.visualElement;
      if (!projection || !projection.layout)
        return false;
      const constraintsBox = measurePageBox(constraintsElement, projection.root, this.visualElement.getTransformPagePoint());
      let measuredConstraints = calcViewportConstraints(projection.layout.layoutBox, constraintsBox);
      if (onMeasureDragConstraints) {
        const userConstraints = onMeasureDragConstraints(convertBoxToBoundingBox(measuredConstraints));
        this.hasMutatedConstraints = !!userConstraints;
        if (userConstraints) {
          measuredConstraints = convertBoundingBoxToBox(userConstraints);
        }
      }
      return measuredConstraints;
    }
    startAnimation(velocity) {
      const { drag: drag2, dragMomentum, dragElastic, dragTransition, dragSnapToOrigin, onDragTransitionEnd } = this.getProps();
      const constraints = this.constraints || {};
      const momentumAnimations = eachAxis((axis) => {
        if (!shouldDrag(axis, drag2, this.currentDirection)) {
          return;
        }
        let transition = constraints && constraints[axis] || {};
        if (dragSnapToOrigin)
          transition = { min: 0, max: 0 };
        const bounceStiffness = dragElastic ? 200 : 1e6;
        const bounceDamping = dragElastic ? 40 : 1e7;
        const inertia2 = {
          type: "inertia",
          velocity: dragMomentum ? velocity[axis] : 0,
          bounceStiffness,
          bounceDamping,
          timeConstant: 750,
          restDelta: 1,
          restSpeed: 10,
          ...dragTransition,
          ...transition
        };
        return this.startAxisValueAnimation(axis, inertia2);
      });
      return Promise.all(momentumAnimations).then(onDragTransitionEnd);
    }
    startAxisValueAnimation(axis, transition) {
      const axisValue = this.getAxisMotionValue(axis);
      addValueToWillChange(this.visualElement, axis);
      return axisValue.start(animateMotionValue(axis, axisValue, 0, transition, this.visualElement, false));
    }
    stopAnimation() {
      eachAxis((axis) => this.getAxisMotionValue(axis).stop());
    }
    pauseAnimation() {
      eachAxis((axis) => {
        var _a;
        return (_a = this.getAxisMotionValue(axis).animation) === null || _a === void 0 ? void 0 : _a.pause();
      });
    }
    getAnimationState(axis) {
      var _a;
      return (_a = this.getAxisMotionValue(axis).animation) === null || _a === void 0 ? void 0 : _a.state;
    }
    /**
     * Drag works differently depending on which props are provided.
     *
     * - If _dragX and _dragY are provided, we output the gesture delta directly to those motion values.
     * - Otherwise, we apply the delta to the x/y motion values.
     */
    getAxisMotionValue(axis) {
      const dragKey = `_drag${axis.toUpperCase()}`;
      const props = this.visualElement.getProps();
      const externalMotionValue = props[dragKey];
      return externalMotionValue ? externalMotionValue : this.visualElement.getValue(axis, (props.initial ? props.initial[axis] : void 0) || 0);
    }
    snapToCursor(point) {
      eachAxis((axis) => {
        const { drag: drag2 } = this.getProps();
        if (!shouldDrag(axis, drag2, this.currentDirection))
          return;
        const { projection } = this.visualElement;
        const axisValue = this.getAxisMotionValue(axis);
        if (projection && projection.layout) {
          const { min, max } = projection.layout.layoutBox[axis];
          axisValue.set(point[axis] - mixNumber(min, max, 0.5));
        }
      });
    }
    /**
     * When the viewport resizes we want to check if the measured constraints
     * have changed and, if so, reposition the element within those new constraints
     * relative to where it was before the resize.
     */
    scalePositionWithinConstraints() {
      if (!this.visualElement.current)
        return;
      const { drag: drag2, dragConstraints } = this.getProps();
      const { projection } = this.visualElement;
      if (!isRefObject(dragConstraints) || !projection || !this.constraints)
        return;
      this.stopAnimation();
      const boxProgress = { x: 0, y: 0 };
      eachAxis((axis) => {
        const axisValue = this.getAxisMotionValue(axis);
        if (axisValue && this.constraints !== false) {
          const latest = axisValue.get();
          boxProgress[axis] = calcOrigin2({ min: latest, max: latest }, this.constraints[axis]);
        }
      });
      const { transformTemplate } = this.visualElement.getProps();
      this.visualElement.current.style.transform = transformTemplate ? transformTemplate({}, "") : "none";
      projection.root && projection.root.updateScroll();
      projection.updateLayout();
      this.resolveConstraints();
      eachAxis((axis) => {
        if (!shouldDrag(axis, drag2, null))
          return;
        const axisValue = this.getAxisMotionValue(axis);
        const { min, max } = this.constraints[axis];
        axisValue.set(mixNumber(min, max, boxProgress[axis]));
      });
    }
    addListeners() {
      if (!this.visualElement.current)
        return;
      elementDragControls.set(this.visualElement, this);
      const element = this.visualElement.current;
      const stopPointerListener = addPointerEvent(element, "pointerdown", (event) => {
        const { drag: drag2, dragListener = true } = this.getProps();
        drag2 && dragListener && this.start(event);
      });
      const measureDragConstraints = () => {
        const { dragConstraints } = this.getProps();
        if (isRefObject(dragConstraints) && dragConstraints.current) {
          this.constraints = this.resolveRefConstraints();
        }
      };
      const { projection } = this.visualElement;
      const stopMeasureLayoutListener = projection.addEventListener("measure", measureDragConstraints);
      if (projection && !projection.layout) {
        projection.root && projection.root.updateScroll();
        projection.updateLayout();
      }
      frame.read(measureDragConstraints);
      const stopResizeListener = addDomEvent(window, "resize", () => this.scalePositionWithinConstraints());
      const stopLayoutUpdateListener = projection.addEventListener("didUpdate", (({ delta, hasLayoutChanged }) => {
        if (this.isDragging && hasLayoutChanged) {
          eachAxis((axis) => {
            const motionValue2 = this.getAxisMotionValue(axis);
            if (!motionValue2)
              return;
            this.originPoint[axis] += delta[axis].translate;
            motionValue2.set(motionValue2.get() + delta[axis].translate);
          });
          this.visualElement.render();
        }
      }));
      return () => {
        stopResizeListener();
        stopPointerListener();
        stopMeasureLayoutListener();
        stopLayoutUpdateListener && stopLayoutUpdateListener();
      };
    }
    getProps() {
      const props = this.visualElement.getProps();
      const { drag: drag2 = false, dragDirectionLock = false, dragPropagation = false, dragConstraints = false, dragElastic = defaultElastic, dragMomentum = true } = props;
      return {
        ...props,
        drag: drag2,
        dragDirectionLock,
        dragPropagation,
        dragConstraints,
        dragElastic,
        dragMomentum
      };
    }
  };
  function shouldDrag(direction, drag2, currentDirection) {
    return (drag2 === true || drag2 === direction) && (currentDirection === null || currentDirection === direction);
  }
  function getCurrentDirection(offset, lockThreshold = 10) {
    let direction = null;
    if (Math.abs(offset.y) > lockThreshold) {
      direction = "y";
    } else if (Math.abs(offset.x) > lockThreshold) {
      direction = "x";
    }
    return direction;
  }

  // ../../../node_modules/framer-motion/dist/es/gestures/drag/index.mjs
  var DragGesture = class extends Feature {
    constructor(node) {
      super(node);
      this.removeGroupControls = noop;
      this.removeListeners = noop;
      this.controls = new VisualElementDragControls(node);
    }
    mount() {
      const { dragControls } = this.node.getProps();
      if (dragControls) {
        this.removeGroupControls = dragControls.subscribe(this.controls);
      }
      this.removeListeners = this.controls.addListeners() || noop;
    }
    unmount() {
      this.removeGroupControls();
      this.removeListeners();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/pan/index.mjs
  var asyncHandler = (handler) => (event, info) => {
    if (handler) {
      frame.postRender(() => handler(event, info));
    }
  };
  var PanGesture = class extends Feature {
    constructor() {
      super(...arguments);
      this.removePointerDownListener = noop;
    }
    onPointerDown(pointerDownEvent) {
      this.session = new PanSession(pointerDownEvent, this.createPanHandlers(), {
        transformPagePoint: this.node.getTransformPagePoint(),
        contextWindow: getContextWindow(this.node)
      });
    }
    createPanHandlers() {
      const { onPanSessionStart, onPanStart, onPan, onPanEnd } = this.node.getProps();
      return {
        onSessionStart: asyncHandler(onPanSessionStart),
        onStart: asyncHandler(onPanStart),
        onMove: onPan,
        onEnd: (event, info) => {
          delete this.session;
          if (onPanEnd) {
            frame.postRender(() => onPanEnd(event, info));
          }
        }
      };
    }
    mount() {
      this.removePointerDownListener = addPointerEvent(this.node.current, "pointerdown", (event) => this.onPointerDown(event));
    }
    update() {
      this.session && this.session.updateHandlers(this.createPanHandlers());
    }
    unmount() {
      this.removePointerDownListener();
      this.session && this.session.end();
    }
  };

  // ../../../node_modules/framer-motion/dist/es/projection/node/state.mjs
  var globalProjectionState = {
    /**
     * Global flag as to whether the tree has animated since the last time
     * we resized the window
     */
    hasAnimatedSinceResize: true,
    /**
     * We set this to true once, on the first update. Any nodes added to the tree beyond that
     * update will be given a `data-projection-id` attribute.
     */
    hasEverUpdated: false
  };

  // ../../../node_modules/framer-motion/dist/es/projection/styles/scale-border-radius.mjs
  function pixelsToPercent(pixels, axis) {
    if (axis.max === axis.min)
      return 0;
    return pixels / (axis.max - axis.min) * 100;
  }
  var correctBorderRadius = {
    correct: (latest, node) => {
      if (!node.target)
        return latest;
      if (typeof latest === "string") {
        if (px.test(latest)) {
          latest = parseFloat(latest);
        } else {
          return latest;
        }
      }
      const x = pixelsToPercent(latest, node.target.x);
      const y = pixelsToPercent(latest, node.target.y);
      return `${x}% ${y}%`;
    }
  };

  // ../../../node_modules/framer-motion/dist/es/projection/styles/scale-box-shadow.mjs
  var correctBoxShadow = {
    correct: (latest, { treeScale, projectionDelta }) => {
      const original = latest;
      const shadow = complex.parse(latest);
      if (shadow.length > 5)
        return original;
      const template = complex.createTransformer(latest);
      const offset = typeof shadow[0] !== "number" ? 1 : 0;
      const xScale = projectionDelta.x.scale * treeScale.x;
      const yScale = projectionDelta.y.scale * treeScale.y;
      shadow[0 + offset] /= xScale;
      shadow[1 + offset] /= yScale;
      const averageScale = mixNumber(xScale, yScale, 0.5);
      if (typeof shadow[2 + offset] === "number")
        shadow[2 + offset] /= averageScale;
      if (typeof shadow[3 + offset] === "number")
        shadow[3 + offset] /= averageScale;
      return template(shadow);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs
  var MeasureLayoutWithContext = class extends Component {
    /**
     * This only mounts projection nodes for components that
     * need measuring, we might want to do it for all components
     * in order to incorporate transforms
     */
    componentDidMount() {
      const { visualElement, layoutGroup, switchLayoutGroup, layoutId } = this.props;
      const { projection } = visualElement;
      addScaleCorrector(defaultScaleCorrectors);
      if (projection) {
        if (layoutGroup.group)
          layoutGroup.group.add(projection);
        if (switchLayoutGroup && switchLayoutGroup.register && layoutId) {
          switchLayoutGroup.register(projection);
        }
        projection.root.didUpdate();
        projection.addEventListener("animationComplete", () => {
          this.safeToRemove();
        });
        projection.setOptions({
          ...projection.options,
          onExitComplete: () => this.safeToRemove()
        });
      }
      globalProjectionState.hasEverUpdated = true;
    }
    getSnapshotBeforeUpdate(prevProps) {
      const { layoutDependency, visualElement, drag: drag2, isPresent } = this.props;
      const projection = visualElement.projection;
      if (!projection)
        return null;
      projection.isPresent = isPresent;
      if (drag2 || prevProps.layoutDependency !== layoutDependency || layoutDependency === void 0) {
        projection.willUpdate();
      } else {
        this.safeToRemove();
      }
      if (prevProps.isPresent !== isPresent) {
        if (isPresent) {
          projection.promote();
        } else if (!projection.relegate()) {
          frame.postRender(() => {
            const stack = projection.getStack();
            if (!stack || !stack.members.length) {
              this.safeToRemove();
            }
          });
        }
      }
      return null;
    }
    componentDidUpdate() {
      const { projection } = this.props.visualElement;
      if (projection) {
        projection.root.didUpdate();
        microtask.postRender(() => {
          if (!projection.currentAnimation && projection.isLead()) {
            this.safeToRemove();
          }
        });
      }
    }
    componentWillUnmount() {
      const { visualElement, layoutGroup, switchLayoutGroup: promoteContext } = this.props;
      const { projection } = visualElement;
      if (projection) {
        projection.scheduleCheckAfterUnmount();
        if (layoutGroup && layoutGroup.group)
          layoutGroup.group.remove(projection);
        if (promoteContext && promoteContext.deregister)
          promoteContext.deregister(projection);
      }
    }
    safeToRemove() {
      const { safeToRemove } = this.props;
      safeToRemove && safeToRemove();
    }
    render() {
      return null;
    }
  };
  function MeasureLayout(props) {
    const [isPresent, safeToRemove] = usePresence();
    const layoutGroup = useContext(LayoutGroupContext);
    return jsx(MeasureLayoutWithContext, { ...props, layoutGroup, switchLayoutGroup: useContext(SwitchLayoutGroupContext), isPresent, safeToRemove });
  }
  var defaultScaleCorrectors = {
    borderRadius: {
      ...correctBorderRadius,
      applyTo: [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomLeftRadius",
        "borderBottomRightRadius"
      ]
    },
    borderTopLeftRadius: correctBorderRadius,
    borderTopRightRadius: correctBorderRadius,
    borderBottomLeftRadius: correctBorderRadius,
    borderBottomRightRadius: correctBorderRadius,
    boxShadow: correctBoxShadow
  };

  // ../../../node_modules/framer-motion/dist/es/animation/animate/single-value.mjs
  function animateSingleValue(value, keyframes2, options) {
    const motionValue$1 = isMotionValue(value) ? value : motionValue(value);
    motionValue$1.start(animateMotionValue("", motionValue$1, keyframes2, options));
    return motionValue$1.animation;
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/utils/is-svg-element.mjs
  function isSVGElement(element) {
    return element instanceof SVGElement && element.tagName !== "svg";
  }

  // ../../../node_modules/framer-motion/dist/es/render/utils/compare-by-depth.mjs
  var compareByDepth = (a, b) => a.depth - b.depth;

  // ../../../node_modules/framer-motion/dist/es/render/utils/flat-tree.mjs
  var FlatTree = class {
    constructor() {
      this.children = [];
      this.isDirty = false;
    }
    add(child) {
      addUniqueItem(this.children, child);
      this.isDirty = true;
    }
    remove(child) {
      removeItem(this.children, child);
      this.isDirty = true;
    }
    forEach(callback) {
      this.isDirty && this.children.sort(compareByDepth);
      this.isDirty = false;
      this.children.forEach(callback);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/delay.mjs
  function delay(callback, timeout) {
    const start = time.now();
    const checkElapsed = ({ timestamp }) => {
      const elapsed = timestamp - start;
      if (elapsed >= timeout) {
        cancelFrame(checkElapsed);
        callback(elapsed - timeout);
      }
    };
    frame.read(checkElapsed, true);
    return () => cancelFrame(checkElapsed);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/animation/mix-values.mjs
  var borders = ["TopLeft", "TopRight", "BottomLeft", "BottomRight"];
  var numBorders = borders.length;
  var asNumber = (value) => typeof value === "string" ? parseFloat(value) : value;
  var isPx = (value) => typeof value === "number" || px.test(value);
  function mixValues(target, follow, lead, progress2, shouldCrossfadeOpacity, isOnlyMember) {
    if (shouldCrossfadeOpacity) {
      target.opacity = mixNumber(
        0,
        // TODO Reinstate this if only child
        lead.opacity !== void 0 ? lead.opacity : 1,
        easeCrossfadeIn(progress2)
      );
      target.opacityExit = mixNumber(follow.opacity !== void 0 ? follow.opacity : 1, 0, easeCrossfadeOut(progress2));
    } else if (isOnlyMember) {
      target.opacity = mixNumber(follow.opacity !== void 0 ? follow.opacity : 1, lead.opacity !== void 0 ? lead.opacity : 1, progress2);
    }
    for (let i = 0; i < numBorders; i++) {
      const borderLabel = `border${borders[i]}Radius`;
      let followRadius = getRadius(follow, borderLabel);
      let leadRadius = getRadius(lead, borderLabel);
      if (followRadius === void 0 && leadRadius === void 0)
        continue;
      followRadius || (followRadius = 0);
      leadRadius || (leadRadius = 0);
      const canMix = followRadius === 0 || leadRadius === 0 || isPx(followRadius) === isPx(leadRadius);
      if (canMix) {
        target[borderLabel] = Math.max(mixNumber(asNumber(followRadius), asNumber(leadRadius), progress2), 0);
        if (percent.test(leadRadius) || percent.test(followRadius)) {
          target[borderLabel] += "%";
        }
      } else {
        target[borderLabel] = leadRadius;
      }
    }
    if (follow.rotate || lead.rotate) {
      target.rotate = mixNumber(follow.rotate || 0, lead.rotate || 0, progress2);
    }
  }
  function getRadius(values, radiusName) {
    return values[radiusName] !== void 0 ? values[radiusName] : values.borderRadius;
  }
  var easeCrossfadeIn = /* @__PURE__ */ compress(0, 0.5, circOut);
  var easeCrossfadeOut = /* @__PURE__ */ compress(0.5, 0.95, noop);
  function compress(min, max, easing) {
    return (p) => {
      if (p < min)
        return 0;
      if (p > max)
        return 1;
      return easing(progress(min, max, p));
    };
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/copy.mjs
  function copyAxisInto(axis, originAxis) {
    axis.min = originAxis.min;
    axis.max = originAxis.max;
  }
  function copyBoxInto(box, originBox) {
    copyAxisInto(box.x, originBox.x);
    copyAxisInto(box.y, originBox.y);
  }
  function copyAxisDeltaInto(delta, originDelta) {
    delta.translate = originDelta.translate;
    delta.scale = originDelta.scale;
    delta.originPoint = originDelta.originPoint;
    delta.origin = originDelta.origin;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/delta-remove.mjs
  function removePointDelta(point, translate, scale2, originPoint, boxScale) {
    point -= translate;
    point = scalePoint(point, 1 / scale2, originPoint);
    if (boxScale !== void 0) {
      point = scalePoint(point, 1 / boxScale, originPoint);
    }
    return point;
  }
  function removeAxisDelta(axis, translate = 0, scale2 = 1, origin = 0.5, boxScale, originAxis = axis, sourceAxis = axis) {
    if (percent.test(translate)) {
      translate = parseFloat(translate);
      const relativeProgress = mixNumber(sourceAxis.min, sourceAxis.max, translate / 100);
      translate = relativeProgress - sourceAxis.min;
    }
    if (typeof translate !== "number")
      return;
    let originPoint = mixNumber(originAxis.min, originAxis.max, origin);
    if (axis === originAxis)
      originPoint -= translate;
    axis.min = removePointDelta(axis.min, translate, scale2, originPoint, boxScale);
    axis.max = removePointDelta(axis.max, translate, scale2, originPoint, boxScale);
  }
  function removeAxisTransforms(axis, transforms, [key, scaleKey, originKey], origin, sourceAxis) {
    removeAxisDelta(axis, transforms[key], transforms[scaleKey], transforms[originKey], transforms.scale, origin, sourceAxis);
  }
  var xKeys = ["x", "scaleX", "originX"];
  var yKeys = ["y", "scaleY", "originY"];
  function removeBoxTransforms(box, transforms, originBox, sourceBox) {
    removeAxisTransforms(box.x, transforms, xKeys, originBox ? originBox.x : void 0, sourceBox ? sourceBox.x : void 0);
    removeAxisTransforms(box.y, transforms, yKeys, originBox ? originBox.y : void 0, sourceBox ? sourceBox.y : void 0);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/geometry/utils.mjs
  function isAxisDeltaZero(delta) {
    return delta.translate === 0 && delta.scale === 1;
  }
  function isDeltaZero(delta) {
    return isAxisDeltaZero(delta.x) && isAxisDeltaZero(delta.y);
  }
  function axisEquals(a, b) {
    return a.min === b.min && a.max === b.max;
  }
  function boxEquals(a, b) {
    return axisEquals(a.x, b.x) && axisEquals(a.y, b.y);
  }
  function axisEqualsRounded(a, b) {
    return Math.round(a.min) === Math.round(b.min) && Math.round(a.max) === Math.round(b.max);
  }
  function boxEqualsRounded(a, b) {
    return axisEqualsRounded(a.x, b.x) && axisEqualsRounded(a.y, b.y);
  }
  function aspectRatio(box) {
    return calcLength(box.x) / calcLength(box.y);
  }
  function axisDeltaEquals(a, b) {
    return a.translate === b.translate && a.scale === b.scale && a.originPoint === b.originPoint;
  }

  // ../../../node_modules/framer-motion/dist/es/projection/shared/stack.mjs
  var NodeStack = class {
    constructor() {
      this.members = [];
    }
    add(node) {
      addUniqueItem(this.members, node);
      node.scheduleRender();
    }
    remove(node) {
      removeItem(this.members, node);
      if (node === this.prevLead) {
        this.prevLead = void 0;
      }
      if (node === this.lead) {
        const prevLead = this.members[this.members.length - 1];
        if (prevLead) {
          this.promote(prevLead);
        }
      }
    }
    relegate(node) {
      const indexOfNode = this.members.findIndex((member) => node === member);
      if (indexOfNode === 0)
        return false;
      let prevLead;
      for (let i = indexOfNode; i >= 0; i--) {
        const member = this.members[i];
        if (member.isPresent !== false) {
          prevLead = member;
          break;
        }
      }
      if (prevLead) {
        this.promote(prevLead);
        return true;
      } else {
        return false;
      }
    }
    promote(node, preserveFollowOpacity) {
      const prevLead = this.lead;
      if (node === prevLead)
        return;
      this.prevLead = prevLead;
      this.lead = node;
      node.show();
      if (prevLead) {
        prevLead.instance && prevLead.scheduleRender();
        node.scheduleRender();
        node.resumeFrom = prevLead;
        if (preserveFollowOpacity) {
          node.resumeFrom.preserveOpacity = true;
        }
        if (prevLead.snapshot) {
          node.snapshot = prevLead.snapshot;
          node.snapshot.latestValues = prevLead.animationValues || prevLead.latestValues;
        }
        if (node.root && node.root.isUpdating) {
          node.isLayoutDirty = true;
        }
        const { crossfade } = node.options;
        if (crossfade === false) {
          prevLead.hide();
        }
      }
    }
    exitAnimationComplete() {
      this.members.forEach((node) => {
        const { options, resumingFrom } = node;
        options.onExitComplete && options.onExitComplete();
        if (resumingFrom) {
          resumingFrom.options.onExitComplete && resumingFrom.options.onExitComplete();
        }
      });
    }
    scheduleRender() {
      this.members.forEach((node) => {
        node.instance && node.scheduleRender(false);
      });
    }
    /**
     * Clear any leads that have been removed this render to prevent them from being
     * used in future animations and to prevent memory leaks
     */
    removeLeadSnapshot() {
      if (this.lead && this.lead.snapshot) {
        this.lead.snapshot = void 0;
      }
    }
  };

  // ../../../node_modules/framer-motion/dist/es/projection/styles/transform.mjs
  function buildProjectionTransform(delta, treeScale, latestTransform) {
    let transform = "";
    const xTranslate = delta.x.translate / treeScale.x;
    const yTranslate = delta.y.translate / treeScale.y;
    const zTranslate = (latestTransform === null || latestTransform === void 0 ? void 0 : latestTransform.z) || 0;
    if (xTranslate || yTranslate || zTranslate) {
      transform = `translate3d(${xTranslate}px, ${yTranslate}px, ${zTranslate}px) `;
    }
    if (treeScale.x !== 1 || treeScale.y !== 1) {
      transform += `scale(${1 / treeScale.x}, ${1 / treeScale.y}) `;
    }
    if (latestTransform) {
      const { transformPerspective, rotate, rotateX, rotateY, skewX, skewY } = latestTransform;
      if (transformPerspective)
        transform = `perspective(${transformPerspective}px) ${transform}`;
      if (rotate)
        transform += `rotate(${rotate}deg) `;
      if (rotateX)
        transform += `rotateX(${rotateX}deg) `;
      if (rotateY)
        transform += `rotateY(${rotateY}deg) `;
      if (skewX)
        transform += `skewX(${skewX}deg) `;
      if (skewY)
        transform += `skewY(${skewY}deg) `;
    }
    const elementScaleX = delta.x.scale * treeScale.x;
    const elementScaleY = delta.y.scale * treeScale.y;
    if (elementScaleX !== 1 || elementScaleY !== 1) {
      transform += `scale(${elementScaleX}, ${elementScaleY})`;
    }
    return transform || "none";
  }

  // ../../../node_modules/framer-motion/dist/es/projection/node/create-projection-node.mjs
  var metrics = {
    type: "projectionFrame",
    totalNodes: 0,
    resolvedTargetDeltas: 0,
    recalculatedProjection: 0
  };
  var isDebug = typeof window !== "undefined" && window.MotionDebug !== void 0;
  var transformAxes = ["", "X", "Y", "Z"];
  var hiddenVisibility = { visibility: "hidden" };
  var animationTarget = 1e3;
  var id2 = 0;
  function resetDistortingTransform(key, visualElement, values, sharedAnimationValues) {
    const { latestValues } = visualElement;
    if (latestValues[key]) {
      values[key] = latestValues[key];
      visualElement.setStaticValue(key, 0);
      if (sharedAnimationValues) {
        sharedAnimationValues[key] = 0;
      }
    }
  }
  function cancelTreeOptimisedTransformAnimations(projectionNode) {
    projectionNode.hasCheckedOptimisedAppear = true;
    if (projectionNode.root === projectionNode)
      return;
    const { visualElement } = projectionNode.options;
    if (!visualElement)
      return;
    const appearId = getOptimisedAppearId(visualElement);
    if (window.MotionHasOptimisedAnimation(appearId, "transform")) {
      const { layout: layout2, layoutId } = projectionNode.options;
      window.MotionCancelOptimisedAnimation(appearId, "transform", frame, !(layout2 || layoutId));
    }
    const { parent } = projectionNode;
    if (parent && !parent.hasCheckedOptimisedAppear) {
      cancelTreeOptimisedTransformAnimations(parent);
    }
  }
  function createProjectionNode2({ attachResizeListener, defaultParent, measureScroll, checkIsScrollRoot, resetTransform }) {
    return class ProjectionNode {
      constructor(latestValues = {}, parent = defaultParent === null || defaultParent === void 0 ? void 0 : defaultParent()) {
        this.id = id2++;
        this.animationId = 0;
        this.children = /* @__PURE__ */ new Set();
        this.options = {};
        this.isTreeAnimating = false;
        this.isAnimationBlocked = false;
        this.isLayoutDirty = false;
        this.isProjectionDirty = false;
        this.isSharedProjectionDirty = false;
        this.isTransformDirty = false;
        this.updateManuallyBlocked = false;
        this.updateBlockedByResize = false;
        this.isUpdating = false;
        this.isSVG = false;
        this.needsReset = false;
        this.shouldResetTransform = false;
        this.hasCheckedOptimisedAppear = false;
        this.treeScale = { x: 1, y: 1 };
        this.eventHandlers = /* @__PURE__ */ new Map();
        this.hasTreeAnimated = false;
        this.updateScheduled = false;
        this.scheduleUpdate = () => this.update();
        this.projectionUpdateScheduled = false;
        this.checkUpdateFailed = () => {
          if (this.isUpdating) {
            this.isUpdating = false;
            this.clearAllSnapshots();
          }
        };
        this.updateProjection = () => {
          this.projectionUpdateScheduled = false;
          if (isDebug) {
            metrics.totalNodes = metrics.resolvedTargetDeltas = metrics.recalculatedProjection = 0;
          }
          this.nodes.forEach(propagateDirtyNodes);
          this.nodes.forEach(resolveTargetDelta);
          this.nodes.forEach(calcProjection);
          this.nodes.forEach(cleanDirtyNodes);
          if (isDebug) {
            window.MotionDebug.record(metrics);
          }
        };
        this.resolvedRelativeTargetAt = 0;
        this.hasProjected = false;
        this.isVisible = true;
        this.animationProgress = 0;
        this.sharedNodes = /* @__PURE__ */ new Map();
        this.latestValues = latestValues;
        this.root = parent ? parent.root || parent : this;
        this.path = parent ? [...parent.path, parent] : [];
        this.parent = parent;
        this.depth = parent ? parent.depth + 1 : 0;
        for (let i = 0; i < this.path.length; i++) {
          this.path[i].shouldResetTransform = true;
        }
        if (this.root === this)
          this.nodes = new FlatTree();
      }
      addEventListener(name, handler) {
        if (!this.eventHandlers.has(name)) {
          this.eventHandlers.set(name, new SubscriptionManager());
        }
        return this.eventHandlers.get(name).add(handler);
      }
      notifyListeners(name, ...args) {
        const subscriptionManager = this.eventHandlers.get(name);
        subscriptionManager && subscriptionManager.notify(...args);
      }
      hasListeners(name) {
        return this.eventHandlers.has(name);
      }
      /**
       * Lifecycles
       */
      mount(instance, isLayoutDirty = this.root.hasTreeAnimated) {
        if (this.instance)
          return;
        this.isSVG = isSVGElement(instance);
        this.instance = instance;
        const { layoutId, layout: layout2, visualElement } = this.options;
        if (visualElement && !visualElement.current) {
          visualElement.mount(instance);
        }
        this.root.nodes.add(this);
        this.parent && this.parent.children.add(this);
        if (isLayoutDirty && (layout2 || layoutId)) {
          this.isLayoutDirty = true;
        }
        if (attachResizeListener) {
          let cancelDelay;
          const resizeUnblockUpdate = () => this.root.updateBlockedByResize = false;
          attachResizeListener(instance, () => {
            this.root.updateBlockedByResize = true;
            cancelDelay && cancelDelay();
            cancelDelay = delay(resizeUnblockUpdate, 250);
            if (globalProjectionState.hasAnimatedSinceResize) {
              globalProjectionState.hasAnimatedSinceResize = false;
              this.nodes.forEach(finishAnimation);
            }
          });
        }
        if (layoutId) {
          this.root.registerSharedNode(layoutId, this);
        }
        if (this.options.animate !== false && visualElement && (layoutId || layout2)) {
          this.addEventListener("didUpdate", ({ delta, hasLayoutChanged, hasRelativeTargetChanged, layout: newLayout }) => {
            if (this.isTreeAnimationBlocked()) {
              this.target = void 0;
              this.relativeTarget = void 0;
              return;
            }
            const layoutTransition = this.options.transition || visualElement.getDefaultTransition() || defaultLayoutTransition;
            const { onLayoutAnimationStart, onLayoutAnimationComplete } = visualElement.getProps();
            const targetChanged = !this.targetLayout || !boxEqualsRounded(this.targetLayout, newLayout) || hasRelativeTargetChanged;
            const hasOnlyRelativeTargetChanged = !hasLayoutChanged && hasRelativeTargetChanged;
            if (this.options.layoutRoot || this.resumeFrom && this.resumeFrom.instance || hasOnlyRelativeTargetChanged || hasLayoutChanged && (targetChanged || !this.currentAnimation)) {
              if (this.resumeFrom) {
                this.resumingFrom = this.resumeFrom;
                this.resumingFrom.resumingFrom = void 0;
              }
              this.setAnimationOrigin(delta, hasOnlyRelativeTargetChanged);
              const animationOptions = {
                ...getValueTransition(layoutTransition, "layout"),
                onPlay: onLayoutAnimationStart,
                onComplete: onLayoutAnimationComplete
              };
              if (visualElement.shouldReduceMotion || this.options.layoutRoot) {
                animationOptions.delay = 0;
                animationOptions.type = false;
              }
              this.startAnimation(animationOptions);
            } else {
              if (!hasLayoutChanged) {
                finishAnimation(this);
              }
              if (this.isLead() && this.options.onExitComplete) {
                this.options.onExitComplete();
              }
            }
            this.targetLayout = newLayout;
          });
        }
      }
      unmount() {
        this.options.layoutId && this.willUpdate();
        this.root.nodes.remove(this);
        const stack = this.getStack();
        stack && stack.remove(this);
        this.parent && this.parent.children.delete(this);
        this.instance = void 0;
        cancelFrame(this.updateProjection);
      }
      // only on the root
      blockUpdate() {
        this.updateManuallyBlocked = true;
      }
      unblockUpdate() {
        this.updateManuallyBlocked = false;
      }
      isUpdateBlocked() {
        return this.updateManuallyBlocked || this.updateBlockedByResize;
      }
      isTreeAnimationBlocked() {
        return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || false;
      }
      // Note: currently only running on root node
      startUpdate() {
        if (this.isUpdateBlocked())
          return;
        this.isUpdating = true;
        this.nodes && this.nodes.forEach(resetSkewAndRotation);
        this.animationId++;
      }
      getTransformTemplate() {
        const { visualElement } = this.options;
        return visualElement && visualElement.getProps().transformTemplate;
      }
      willUpdate(shouldNotifyListeners = true) {
        this.root.hasTreeAnimated = true;
        if (this.root.isUpdateBlocked()) {
          this.options.onExitComplete && this.options.onExitComplete();
          return;
        }
        if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear) {
          cancelTreeOptimisedTransformAnimations(this);
        }
        !this.root.isUpdating && this.root.startUpdate();
        if (this.isLayoutDirty)
          return;
        this.isLayoutDirty = true;
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          node.shouldResetTransform = true;
          node.updateScroll("snapshot");
          if (node.options.layoutRoot) {
            node.willUpdate(false);
          }
        }
        const { layoutId, layout: layout2 } = this.options;
        if (layoutId === void 0 && !layout2)
          return;
        const transformTemplate = this.getTransformTemplate();
        this.prevTransformTemplateValue = transformTemplate ? transformTemplate(this.latestValues, "") : void 0;
        this.updateSnapshot();
        shouldNotifyListeners && this.notifyListeners("willUpdate");
      }
      update() {
        this.updateScheduled = false;
        const updateWasBlocked = this.isUpdateBlocked();
        if (updateWasBlocked) {
          this.unblockUpdate();
          this.clearAllSnapshots();
          this.nodes.forEach(clearMeasurements);
          return;
        }
        if (!this.isUpdating) {
          this.nodes.forEach(clearIsLayoutDirty);
        }
        this.isUpdating = false;
        this.nodes.forEach(resetTransformStyle);
        this.nodes.forEach(updateLayout);
        this.nodes.forEach(notifyLayoutUpdate);
        this.clearAllSnapshots();
        const now2 = time.now();
        frameData.delta = clamp(0, 1e3 / 60, now2 - frameData.timestamp);
        frameData.timestamp = now2;
        frameData.isProcessing = true;
        frameSteps.update.process(frameData);
        frameSteps.preRender.process(frameData);
        frameSteps.render.process(frameData);
        frameData.isProcessing = false;
      }
      didUpdate() {
        if (!this.updateScheduled) {
          this.updateScheduled = true;
          microtask.read(this.scheduleUpdate);
        }
      }
      clearAllSnapshots() {
        this.nodes.forEach(clearSnapshot);
        this.sharedNodes.forEach(removeLeadSnapshots);
      }
      scheduleUpdateProjection() {
        if (!this.projectionUpdateScheduled) {
          this.projectionUpdateScheduled = true;
          frame.preRender(this.updateProjection, false, true);
        }
      }
      scheduleCheckAfterUnmount() {
        frame.postRender(() => {
          if (this.isLayoutDirty) {
            this.root.didUpdate();
          } else {
            this.root.checkUpdateFailed();
          }
        });
      }
      /**
       * Update measurements
       */
      updateSnapshot() {
        if (this.snapshot || !this.instance)
          return;
        this.snapshot = this.measure();
      }
      updateLayout() {
        if (!this.instance)
          return;
        this.updateScroll();
        if (!(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty) {
          return;
        }
        if (this.resumeFrom && !this.resumeFrom.instance) {
          for (let i = 0; i < this.path.length; i++) {
            const node = this.path[i];
            node.updateScroll();
          }
        }
        const prevLayout = this.layout;
        this.layout = this.measure(false);
        this.layoutCorrected = createBox();
        this.isLayoutDirty = false;
        this.projectionDelta = void 0;
        this.notifyListeners("measure", this.layout.layoutBox);
        const { visualElement } = this.options;
        visualElement && visualElement.notify("LayoutMeasure", this.layout.layoutBox, prevLayout ? prevLayout.layoutBox : void 0);
      }
      updateScroll(phase = "measure") {
        let needsMeasurement = Boolean(this.options.layoutScroll && this.instance);
        if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === phase) {
          needsMeasurement = false;
        }
        if (needsMeasurement) {
          const isRoot = checkIsScrollRoot(this.instance);
          this.scroll = {
            animationId: this.root.animationId,
            phase,
            isRoot,
            offset: measureScroll(this.instance),
            wasRoot: this.scroll ? this.scroll.isRoot : isRoot
          };
        }
      }
      resetTransform() {
        if (!resetTransform)
          return;
        const isResetRequested = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout;
        const hasProjection = this.projectionDelta && !isDeltaZero(this.projectionDelta);
        const transformTemplate = this.getTransformTemplate();
        const transformTemplateValue = transformTemplate ? transformTemplate(this.latestValues, "") : void 0;
        const transformTemplateHasChanged = transformTemplateValue !== this.prevTransformTemplateValue;
        if (isResetRequested && (hasProjection || hasTransform(this.latestValues) || transformTemplateHasChanged)) {
          resetTransform(this.instance, transformTemplateValue);
          this.shouldResetTransform = false;
          this.scheduleRender();
        }
      }
      measure(removeTransform = true) {
        const pageBox = this.measurePageBox();
        let layoutBox = this.removeElementScroll(pageBox);
        if (removeTransform) {
          layoutBox = this.removeTransform(layoutBox);
        }
        roundBox(layoutBox);
        return {
          animationId: this.root.animationId,
          measuredBox: pageBox,
          layoutBox,
          latestValues: {},
          source: this.id
        };
      }
      measurePageBox() {
        var _a;
        const { visualElement } = this.options;
        if (!visualElement)
          return createBox();
        const box = visualElement.measureViewportBox();
        const wasInScrollRoot = ((_a = this.scroll) === null || _a === void 0 ? void 0 : _a.wasRoot) || this.path.some(checkNodeWasScrollRoot);
        if (!wasInScrollRoot) {
          const { scroll } = this.root;
          if (scroll) {
            translateAxis(box.x, scroll.offset.x);
            translateAxis(box.y, scroll.offset.y);
          }
        }
        return box;
      }
      removeElementScroll(box) {
        var _a;
        const boxWithoutScroll = createBox();
        copyBoxInto(boxWithoutScroll, box);
        if ((_a = this.scroll) === null || _a === void 0 ? void 0 : _a.wasRoot) {
          return boxWithoutScroll;
        }
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          const { scroll, options } = node;
          if (node !== this.root && scroll && options.layoutScroll) {
            if (scroll.wasRoot) {
              copyBoxInto(boxWithoutScroll, box);
            }
            translateAxis(boxWithoutScroll.x, scroll.offset.x);
            translateAxis(boxWithoutScroll.y, scroll.offset.y);
          }
        }
        return boxWithoutScroll;
      }
      applyTransform(box, transformOnly = false) {
        const withTransforms = createBox();
        copyBoxInto(withTransforms, box);
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          if (!transformOnly && node.options.layoutScroll && node.scroll && node !== node.root) {
            transformBox(withTransforms, {
              x: -node.scroll.offset.x,
              y: -node.scroll.offset.y
            });
          }
          if (!hasTransform(node.latestValues))
            continue;
          transformBox(withTransforms, node.latestValues);
        }
        if (hasTransform(this.latestValues)) {
          transformBox(withTransforms, this.latestValues);
        }
        return withTransforms;
      }
      removeTransform(box) {
        const boxWithoutTransform = createBox();
        copyBoxInto(boxWithoutTransform, box);
        for (let i = 0; i < this.path.length; i++) {
          const node = this.path[i];
          if (!node.instance)
            continue;
          if (!hasTransform(node.latestValues))
            continue;
          hasScale(node.latestValues) && node.updateSnapshot();
          const sourceBox = createBox();
          const nodeBox = node.measurePageBox();
          copyBoxInto(sourceBox, nodeBox);
          removeBoxTransforms(boxWithoutTransform, node.latestValues, node.snapshot ? node.snapshot.layoutBox : void 0, sourceBox);
        }
        if (hasTransform(this.latestValues)) {
          removeBoxTransforms(boxWithoutTransform, this.latestValues);
        }
        return boxWithoutTransform;
      }
      setTargetDelta(delta) {
        this.targetDelta = delta;
        this.root.scheduleUpdateProjection();
        this.isProjectionDirty = true;
      }
      setOptions(options) {
        this.options = {
          ...this.options,
          ...options,
          crossfade: options.crossfade !== void 0 ? options.crossfade : true
        };
      }
      clearMeasurements() {
        this.scroll = void 0;
        this.layout = void 0;
        this.snapshot = void 0;
        this.prevTransformTemplateValue = void 0;
        this.targetDelta = void 0;
        this.target = void 0;
        this.isLayoutDirty = false;
      }
      forceRelativeParentToResolveTarget() {
        if (!this.relativeParent)
          return;
        if (this.relativeParent.resolvedRelativeTargetAt !== frameData.timestamp) {
          this.relativeParent.resolveTargetDelta(true);
        }
      }
      resolveTargetDelta(forceRecalculation = false) {
        var _a;
        const lead = this.getLead();
        this.isProjectionDirty || (this.isProjectionDirty = lead.isProjectionDirty);
        this.isTransformDirty || (this.isTransformDirty = lead.isTransformDirty);
        this.isSharedProjectionDirty || (this.isSharedProjectionDirty = lead.isSharedProjectionDirty);
        const isShared = Boolean(this.resumingFrom) || this !== lead;
        const canSkip = !(forceRecalculation || isShared && this.isSharedProjectionDirty || this.isProjectionDirty || ((_a = this.parent) === null || _a === void 0 ? void 0 : _a.isProjectionDirty) || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize);
        if (canSkip)
          return;
        const { layout: layout2, layoutId } = this.options;
        if (!this.layout || !(layout2 || layoutId))
          return;
        this.resolvedRelativeTargetAt = frameData.timestamp;
        if (!this.targetDelta && !this.relativeTarget) {
          const relativeParent = this.getClosestProjectingParent();
          if (relativeParent && relativeParent.layout && this.animationProgress !== 1) {
            this.relativeParent = relativeParent;
            this.forceRelativeParentToResolveTarget();
            this.relativeTarget = createBox();
            this.relativeTargetOrigin = createBox();
            calcRelativePosition(this.relativeTargetOrigin, this.layout.layoutBox, relativeParent.layout.layoutBox);
            copyBoxInto(this.relativeTarget, this.relativeTargetOrigin);
          } else {
            this.relativeParent = this.relativeTarget = void 0;
          }
        }
        if (!this.relativeTarget && !this.targetDelta)
          return;
        if (!this.target) {
          this.target = createBox();
          this.targetWithTransforms = createBox();
        }
        if (this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target) {
          this.forceRelativeParentToResolveTarget();
          calcRelativeBox(this.target, this.relativeTarget, this.relativeParent.target);
        } else if (this.targetDelta) {
          if (Boolean(this.resumingFrom)) {
            this.target = this.applyTransform(this.layout.layoutBox);
          } else {
            copyBoxInto(this.target, this.layout.layoutBox);
          }
          applyBoxDelta(this.target, this.targetDelta);
        } else {
          copyBoxInto(this.target, this.layout.layoutBox);
        }
        if (this.attemptToResolveRelativeTarget) {
          this.attemptToResolveRelativeTarget = false;
          const relativeParent = this.getClosestProjectingParent();
          if (relativeParent && Boolean(relativeParent.resumingFrom) === Boolean(this.resumingFrom) && !relativeParent.options.layoutScroll && relativeParent.target && this.animationProgress !== 1) {
            this.relativeParent = relativeParent;
            this.forceRelativeParentToResolveTarget();
            this.relativeTarget = createBox();
            this.relativeTargetOrigin = createBox();
            calcRelativePosition(this.relativeTargetOrigin, this.target, relativeParent.target);
            copyBoxInto(this.relativeTarget, this.relativeTargetOrigin);
          } else {
            this.relativeParent = this.relativeTarget = void 0;
          }
        }
        if (isDebug) {
          metrics.resolvedTargetDeltas++;
        }
      }
      getClosestProjectingParent() {
        if (!this.parent || hasScale(this.parent.latestValues) || has2DTranslate(this.parent.latestValues)) {
          return void 0;
        }
        if (this.parent.isProjecting()) {
          return this.parent;
        } else {
          return this.parent.getClosestProjectingParent();
        }
      }
      isProjecting() {
        return Boolean((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
      }
      calcProjection() {
        var _a;
        const lead = this.getLead();
        const isShared = Boolean(this.resumingFrom) || this !== lead;
        let canSkip = true;
        if (this.isProjectionDirty || ((_a = this.parent) === null || _a === void 0 ? void 0 : _a.isProjectionDirty)) {
          canSkip = false;
        }
        if (isShared && (this.isSharedProjectionDirty || this.isTransformDirty)) {
          canSkip = false;
        }
        if (this.resolvedRelativeTargetAt === frameData.timestamp) {
          canSkip = false;
        }
        if (canSkip)
          return;
        const { layout: layout2, layoutId } = this.options;
        this.isTreeAnimating = Boolean(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation);
        if (!this.isTreeAnimating) {
          this.targetDelta = this.relativeTarget = void 0;
        }
        if (!this.layout || !(layout2 || layoutId))
          return;
        copyBoxInto(this.layoutCorrected, this.layout.layoutBox);
        const prevTreeScaleX = this.treeScale.x;
        const prevTreeScaleY = this.treeScale.y;
        applyTreeDeltas(this.layoutCorrected, this.treeScale, this.path, isShared);
        if (lead.layout && !lead.target && (this.treeScale.x !== 1 || this.treeScale.y !== 1)) {
          lead.target = lead.layout.layoutBox;
          lead.targetWithTransforms = createBox();
        }
        const { target } = lead;
        if (!target) {
          if (this.prevProjectionDelta) {
            this.createProjectionDeltas();
            this.scheduleRender();
          }
          return;
        }
        if (!this.projectionDelta || !this.prevProjectionDelta) {
          this.createProjectionDeltas();
        } else {
          copyAxisDeltaInto(this.prevProjectionDelta.x, this.projectionDelta.x);
          copyAxisDeltaInto(this.prevProjectionDelta.y, this.projectionDelta.y);
        }
        calcBoxDelta(this.projectionDelta, this.layoutCorrected, target, this.latestValues);
        if (this.treeScale.x !== prevTreeScaleX || this.treeScale.y !== prevTreeScaleY || !axisDeltaEquals(this.projectionDelta.x, this.prevProjectionDelta.x) || !axisDeltaEquals(this.projectionDelta.y, this.prevProjectionDelta.y)) {
          this.hasProjected = true;
          this.scheduleRender();
          this.notifyListeners("projectionUpdate", target);
        }
        if (isDebug) {
          metrics.recalculatedProjection++;
        }
      }
      hide() {
        this.isVisible = false;
      }
      show() {
        this.isVisible = true;
      }
      scheduleRender(notifyAll = true) {
        var _a;
        (_a = this.options.visualElement) === null || _a === void 0 ? void 0 : _a.scheduleRender();
        if (notifyAll) {
          const stack = this.getStack();
          stack && stack.scheduleRender();
        }
        if (this.resumingFrom && !this.resumingFrom.instance) {
          this.resumingFrom = void 0;
        }
      }
      createProjectionDeltas() {
        this.prevProjectionDelta = createDelta();
        this.projectionDelta = createDelta();
        this.projectionDeltaWithTransform = createDelta();
      }
      setAnimationOrigin(delta, hasOnlyRelativeTargetChanged = false) {
        const snapshot = this.snapshot;
        const snapshotLatestValues = snapshot ? snapshot.latestValues : {};
        const mixedValues = { ...this.latestValues };
        const targetDelta = createDelta();
        if (!this.relativeParent || !this.relativeParent.options.layoutRoot) {
          this.relativeTarget = this.relativeTargetOrigin = void 0;
        }
        this.attemptToResolveRelativeTarget = !hasOnlyRelativeTargetChanged;
        const relativeLayout = createBox();
        const snapshotSource = snapshot ? snapshot.source : void 0;
        const layoutSource = this.layout ? this.layout.source : void 0;
        const isSharedLayoutAnimation = snapshotSource !== layoutSource;
        const stack = this.getStack();
        const isOnlyMember = !stack || stack.members.length <= 1;
        const shouldCrossfadeOpacity = Boolean(isSharedLayoutAnimation && !isOnlyMember && this.options.crossfade === true && !this.path.some(hasOpacityCrossfade));
        this.animationProgress = 0;
        let prevRelativeTarget;
        this.mixTargetDelta = (latest) => {
          const progress2 = latest / 1e3;
          mixAxisDelta(targetDelta.x, delta.x, progress2);
          mixAxisDelta(targetDelta.y, delta.y, progress2);
          this.setTargetDelta(targetDelta);
          if (this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout) {
            calcRelativePosition(relativeLayout, this.layout.layoutBox, this.relativeParent.layout.layoutBox);
            mixBox(this.relativeTarget, this.relativeTargetOrigin, relativeLayout, progress2);
            if (prevRelativeTarget && boxEquals(this.relativeTarget, prevRelativeTarget)) {
              this.isProjectionDirty = false;
            }
            if (!prevRelativeTarget)
              prevRelativeTarget = createBox();
            copyBoxInto(prevRelativeTarget, this.relativeTarget);
          }
          if (isSharedLayoutAnimation) {
            this.animationValues = mixedValues;
            mixValues(mixedValues, snapshotLatestValues, this.latestValues, progress2, shouldCrossfadeOpacity, isOnlyMember);
          }
          this.root.scheduleUpdateProjection();
          this.scheduleRender();
          this.animationProgress = progress2;
        };
        this.mixTargetDelta(this.options.layoutRoot ? 1e3 : 0);
      }
      startAnimation(options) {
        this.notifyListeners("animationStart");
        this.currentAnimation && this.currentAnimation.stop();
        if (this.resumingFrom && this.resumingFrom.currentAnimation) {
          this.resumingFrom.currentAnimation.stop();
        }
        if (this.pendingAnimation) {
          cancelFrame(this.pendingAnimation);
          this.pendingAnimation = void 0;
        }
        this.pendingAnimation = frame.update(() => {
          globalProjectionState.hasAnimatedSinceResize = true;
          this.currentAnimation = animateSingleValue(0, animationTarget, {
            ...options,
            onUpdate: (latest) => {
              this.mixTargetDelta(latest);
              options.onUpdate && options.onUpdate(latest);
            },
            onComplete: () => {
              options.onComplete && options.onComplete();
              this.completeAnimation();
            }
          });
          if (this.resumingFrom) {
            this.resumingFrom.currentAnimation = this.currentAnimation;
          }
          this.pendingAnimation = void 0;
        });
      }
      completeAnimation() {
        if (this.resumingFrom) {
          this.resumingFrom.currentAnimation = void 0;
          this.resumingFrom.preserveOpacity = void 0;
        }
        const stack = this.getStack();
        stack && stack.exitAnimationComplete();
        this.resumingFrom = this.currentAnimation = this.animationValues = void 0;
        this.notifyListeners("animationComplete");
      }
      finishAnimation() {
        if (this.currentAnimation) {
          this.mixTargetDelta && this.mixTargetDelta(animationTarget);
          this.currentAnimation.stop();
        }
        this.completeAnimation();
      }
      applyTransformsToTarget() {
        const lead = this.getLead();
        let { targetWithTransforms, target, layout: layout2, latestValues } = lead;
        if (!targetWithTransforms || !target || !layout2)
          return;
        if (this !== lead && this.layout && layout2 && shouldAnimatePositionOnly(this.options.animationType, this.layout.layoutBox, layout2.layoutBox)) {
          target = this.target || createBox();
          const xLength = calcLength(this.layout.layoutBox.x);
          target.x.min = lead.target.x.min;
          target.x.max = target.x.min + xLength;
          const yLength = calcLength(this.layout.layoutBox.y);
          target.y.min = lead.target.y.min;
          target.y.max = target.y.min + yLength;
        }
        copyBoxInto(targetWithTransforms, target);
        transformBox(targetWithTransforms, latestValues);
        calcBoxDelta(this.projectionDeltaWithTransform, this.layoutCorrected, targetWithTransforms, latestValues);
      }
      registerSharedNode(layoutId, node) {
        if (!this.sharedNodes.has(layoutId)) {
          this.sharedNodes.set(layoutId, new NodeStack());
        }
        const stack = this.sharedNodes.get(layoutId);
        stack.add(node);
        const config = node.options.initialPromotionConfig;
        node.promote({
          transition: config ? config.transition : void 0,
          preserveFollowOpacity: config && config.shouldPreserveFollowOpacity ? config.shouldPreserveFollowOpacity(node) : void 0
        });
      }
      isLead() {
        const stack = this.getStack();
        return stack ? stack.lead === this : true;
      }
      getLead() {
        var _a;
        const { layoutId } = this.options;
        return layoutId ? ((_a = this.getStack()) === null || _a === void 0 ? void 0 : _a.lead) || this : this;
      }
      getPrevLead() {
        var _a;
        const { layoutId } = this.options;
        return layoutId ? (_a = this.getStack()) === null || _a === void 0 ? void 0 : _a.prevLead : void 0;
      }
      getStack() {
        const { layoutId } = this.options;
        if (layoutId)
          return this.root.sharedNodes.get(layoutId);
      }
      promote({ needsReset, transition, preserveFollowOpacity } = {}) {
        const stack = this.getStack();
        if (stack)
          stack.promote(this, preserveFollowOpacity);
        if (needsReset) {
          this.projectionDelta = void 0;
          this.needsReset = true;
        }
        if (transition)
          this.setOptions({ transition });
      }
      relegate() {
        const stack = this.getStack();
        if (stack) {
          return stack.relegate(this);
        } else {
          return false;
        }
      }
      resetSkewAndRotation() {
        const { visualElement } = this.options;
        if (!visualElement)
          return;
        let hasDistortingTransform = false;
        const { latestValues } = visualElement;
        if (latestValues.z || latestValues.rotate || latestValues.rotateX || latestValues.rotateY || latestValues.rotateZ || latestValues.skewX || latestValues.skewY) {
          hasDistortingTransform = true;
        }
        if (!hasDistortingTransform)
          return;
        const resetValues = {};
        if (latestValues.z) {
          resetDistortingTransform("z", visualElement, resetValues, this.animationValues);
        }
        for (let i = 0; i < transformAxes.length; i++) {
          resetDistortingTransform(`rotate${transformAxes[i]}`, visualElement, resetValues, this.animationValues);
          resetDistortingTransform(`skew${transformAxes[i]}`, visualElement, resetValues, this.animationValues);
        }
        visualElement.render();
        for (const key in resetValues) {
          visualElement.setStaticValue(key, resetValues[key]);
          if (this.animationValues) {
            this.animationValues[key] = resetValues[key];
          }
        }
        visualElement.scheduleRender();
      }
      getProjectionStyles(styleProp) {
        var _a, _b;
        if (!this.instance || this.isSVG)
          return void 0;
        if (!this.isVisible) {
          return hiddenVisibility;
        }
        const styles = {
          visibility: ""
        };
        const transformTemplate = this.getTransformTemplate();
        if (this.needsReset) {
          this.needsReset = false;
          styles.opacity = "";
          styles.pointerEvents = resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "";
          styles.transform = transformTemplate ? transformTemplate(this.latestValues, "") : "none";
          return styles;
        }
        const lead = this.getLead();
        if (!this.projectionDelta || !this.layout || !lead.target) {
          const emptyStyles = {};
          if (this.options.layoutId) {
            emptyStyles.opacity = this.latestValues.opacity !== void 0 ? this.latestValues.opacity : 1;
            emptyStyles.pointerEvents = resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "";
          }
          if (this.hasProjected && !hasTransform(this.latestValues)) {
            emptyStyles.transform = transformTemplate ? transformTemplate({}, "") : "none";
            this.hasProjected = false;
          }
          return emptyStyles;
        }
        const valuesToRender = lead.animationValues || lead.latestValues;
        this.applyTransformsToTarget();
        styles.transform = buildProjectionTransform(this.projectionDeltaWithTransform, this.treeScale, valuesToRender);
        if (transformTemplate) {
          styles.transform = transformTemplate(valuesToRender, styles.transform);
        }
        const { x, y } = this.projectionDelta;
        styles.transformOrigin = `${x.origin * 100}% ${y.origin * 100}% 0`;
        if (lead.animationValues) {
          styles.opacity = lead === this ? (_b = (_a = valuesToRender.opacity) !== null && _a !== void 0 ? _a : this.latestValues.opacity) !== null && _b !== void 0 ? _b : 1 : this.preserveOpacity ? this.latestValues.opacity : valuesToRender.opacityExit;
        } else {
          styles.opacity = lead === this ? valuesToRender.opacity !== void 0 ? valuesToRender.opacity : "" : valuesToRender.opacityExit !== void 0 ? valuesToRender.opacityExit : 0;
        }
        for (const key in scaleCorrectors) {
          if (valuesToRender[key] === void 0)
            continue;
          const { correct, applyTo } = scaleCorrectors[key];
          const corrected = styles.transform === "none" ? valuesToRender[key] : correct(valuesToRender[key], lead);
          if (applyTo) {
            const num = applyTo.length;
            for (let i = 0; i < num; i++) {
              styles[applyTo[i]] = corrected;
            }
          } else {
            styles[key] = corrected;
          }
        }
        if (this.options.layoutId) {
          styles.pointerEvents = lead === this ? resolveMotionValue(styleProp === null || styleProp === void 0 ? void 0 : styleProp.pointerEvents) || "" : "none";
        }
        return styles;
      }
      clearSnapshot() {
        this.resumeFrom = this.snapshot = void 0;
      }
      // Only run on root
      resetTree() {
        this.root.nodes.forEach((node) => {
          var _a;
          return (_a = node.currentAnimation) === null || _a === void 0 ? void 0 : _a.stop();
        });
        this.root.nodes.forEach(clearMeasurements);
        this.root.sharedNodes.clear();
      }
    };
  }
  function updateLayout(node) {
    node.updateLayout();
  }
  function notifyLayoutUpdate(node) {
    var _a;
    const snapshot = ((_a = node.resumeFrom) === null || _a === void 0 ? void 0 : _a.snapshot) || node.snapshot;
    if (node.isLead() && node.layout && snapshot && node.hasListeners("didUpdate")) {
      const { layoutBox: layout2, measuredBox: measuredLayout } = node.layout;
      const { animationType } = node.options;
      const isShared = snapshot.source !== node.layout.source;
      if (animationType === "size") {
        eachAxis((axis) => {
          const axisSnapshot = isShared ? snapshot.measuredBox[axis] : snapshot.layoutBox[axis];
          const length = calcLength(axisSnapshot);
          axisSnapshot.min = layout2[axis].min;
          axisSnapshot.max = axisSnapshot.min + length;
        });
      } else if (shouldAnimatePositionOnly(animationType, snapshot.layoutBox, layout2)) {
        eachAxis((axis) => {
          const axisSnapshot = isShared ? snapshot.measuredBox[axis] : snapshot.layoutBox[axis];
          const length = calcLength(layout2[axis]);
          axisSnapshot.max = axisSnapshot.min + length;
          if (node.relativeTarget && !node.currentAnimation) {
            node.isProjectionDirty = true;
            node.relativeTarget[axis].max = node.relativeTarget[axis].min + length;
          }
        });
      }
      const layoutDelta = createDelta();
      calcBoxDelta(layoutDelta, layout2, snapshot.layoutBox);
      const visualDelta = createDelta();
      if (isShared) {
        calcBoxDelta(visualDelta, node.applyTransform(measuredLayout, true), snapshot.measuredBox);
      } else {
        calcBoxDelta(visualDelta, layout2, snapshot.layoutBox);
      }
      const hasLayoutChanged = !isDeltaZero(layoutDelta);
      let hasRelativeTargetChanged = false;
      if (!node.resumeFrom) {
        const relativeParent = node.getClosestProjectingParent();
        if (relativeParent && !relativeParent.resumeFrom) {
          const { snapshot: parentSnapshot, layout: parentLayout } = relativeParent;
          if (parentSnapshot && parentLayout) {
            const relativeSnapshot = createBox();
            calcRelativePosition(relativeSnapshot, snapshot.layoutBox, parentSnapshot.layoutBox);
            const relativeLayout = createBox();
            calcRelativePosition(relativeLayout, layout2, parentLayout.layoutBox);
            if (!boxEqualsRounded(relativeSnapshot, relativeLayout)) {
              hasRelativeTargetChanged = true;
            }
            if (relativeParent.options.layoutRoot) {
              node.relativeTarget = relativeLayout;
              node.relativeTargetOrigin = relativeSnapshot;
              node.relativeParent = relativeParent;
            }
          }
        }
      }
      node.notifyListeners("didUpdate", {
        layout: layout2,
        snapshot,
        delta: visualDelta,
        layoutDelta,
        hasLayoutChanged,
        hasRelativeTargetChanged
      });
    } else if (node.isLead()) {
      const { onExitComplete } = node.options;
      onExitComplete && onExitComplete();
    }
    node.options.transition = void 0;
  }
  function propagateDirtyNodes(node) {
    if (isDebug) {
      metrics.totalNodes++;
    }
    if (!node.parent)
      return;
    if (!node.isProjecting()) {
      node.isProjectionDirty = node.parent.isProjectionDirty;
    }
    node.isSharedProjectionDirty || (node.isSharedProjectionDirty = Boolean(node.isProjectionDirty || node.parent.isProjectionDirty || node.parent.isSharedProjectionDirty));
    node.isTransformDirty || (node.isTransformDirty = node.parent.isTransformDirty);
  }
  function cleanDirtyNodes(node) {
    node.isProjectionDirty = node.isSharedProjectionDirty = node.isTransformDirty = false;
  }
  function clearSnapshot(node) {
    node.clearSnapshot();
  }
  function clearMeasurements(node) {
    node.clearMeasurements();
  }
  function clearIsLayoutDirty(node) {
    node.isLayoutDirty = false;
  }
  function resetTransformStyle(node) {
    const { visualElement } = node.options;
    if (visualElement && visualElement.getProps().onBeforeLayoutMeasure) {
      visualElement.notify("BeforeLayoutMeasure");
    }
    node.resetTransform();
  }
  function finishAnimation(node) {
    node.finishAnimation();
    node.targetDelta = node.relativeTarget = node.target = void 0;
    node.isProjectionDirty = true;
  }
  function resolveTargetDelta(node) {
    node.resolveTargetDelta();
  }
  function calcProjection(node) {
    node.calcProjection();
  }
  function resetSkewAndRotation(node) {
    node.resetSkewAndRotation();
  }
  function removeLeadSnapshots(stack) {
    stack.removeLeadSnapshot();
  }
  function mixAxisDelta(output, delta, p) {
    output.translate = mixNumber(delta.translate, 0, p);
    output.scale = mixNumber(delta.scale, 1, p);
    output.origin = delta.origin;
    output.originPoint = delta.originPoint;
  }
  function mixAxis(output, from, to, p) {
    output.min = mixNumber(from.min, to.min, p);
    output.max = mixNumber(from.max, to.max, p);
  }
  function mixBox(output, from, to, p) {
    mixAxis(output.x, from.x, to.x, p);
    mixAxis(output.y, from.y, to.y, p);
  }
  function hasOpacityCrossfade(node) {
    return node.animationValues && node.animationValues.opacityExit !== void 0;
  }
  var defaultLayoutTransition = {
    duration: 0.45,
    ease: [0.4, 0, 0.1, 1]
  };
  var userAgentContains = (string) => typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().includes(string);
  var roundPoint = userAgentContains("applewebkit/") && !userAgentContains("chrome/") ? Math.round : noop;
  function roundAxis(axis) {
    axis.min = roundPoint(axis.min);
    axis.max = roundPoint(axis.max);
  }
  function roundBox(box) {
    roundAxis(box.x);
    roundAxis(box.y);
  }
  function shouldAnimatePositionOnly(animationType, snapshot, layout2) {
    return animationType === "position" || animationType === "preserve-aspect" && !isNear(aspectRatio(snapshot), aspectRatio(layout2), 0.2);
  }
  function checkNodeWasScrollRoot(node) {
    var _a;
    return node !== node.root && ((_a = node.scroll) === null || _a === void 0 ? void 0 : _a.wasRoot);
  }

  // ../../../node_modules/framer-motion/dist/es/projection/node/DocumentProjectionNode.mjs
  var DocumentProjectionNode = createProjectionNode2({
    attachResizeListener: (ref, notify) => addDomEvent(ref, "resize", notify),
    measureScroll: () => ({
      x: document.documentElement.scrollLeft || document.body.scrollLeft,
      y: document.documentElement.scrollTop || document.body.scrollTop
    }),
    checkIsScrollRoot: () => true
  });

  // ../../../node_modules/framer-motion/dist/es/projection/node/HTMLProjectionNode.mjs
  var rootProjectionNode = {
    current: void 0
  };
  var HTMLProjectionNode = createProjectionNode2({
    measureScroll: (instance) => ({
      x: instance.scrollLeft,
      y: instance.scrollTop
    }),
    defaultParent: () => {
      if (!rootProjectionNode.current) {
        const documentNode = new DocumentProjectionNode({});
        documentNode.mount(window);
        documentNode.setOptions({ layoutScroll: true });
        rootProjectionNode.current = documentNode;
      }
      return rootProjectionNode.current;
    },
    resetTransform: (instance, value) => {
      instance.style.transform = value !== void 0 ? value : "none";
    },
    checkIsScrollRoot: (instance) => Boolean(window.getComputedStyle(instance).position === "fixed")
  });

  // ../../../node_modules/framer-motion/dist/es/motion/features/drag.mjs
  var drag = {
    pan: {
      Feature: PanGesture
    },
    drag: {
      Feature: DragGesture,
      ProjectionNode: HTMLProjectionNode,
      MeasureLayout
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/hover.mjs
  function handleHoverEvent(node, event, lifecycle) {
    const { props } = node;
    if (node.animationState && props.whileHover) {
      node.animationState.setActive("whileHover", lifecycle === "Start");
    }
    const eventName = "onHover" + lifecycle;
    const callback = props[eventName];
    if (callback) {
      frame.postRender(() => callback(event, extractEventInfo(event)));
    }
  }
  var HoverGesture = class extends Feature {
    mount() {
      const { current } = this.node;
      if (!current)
        return;
      this.unmount = hover(current, (startEvent) => {
        handleHoverEvent(this.node, startEvent, "Start");
        return (endEvent) => handleHoverEvent(this.node, endEvent, "End");
      });
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/focus.mjs
  var FocusGesture = class extends Feature {
    constructor() {
      super(...arguments);
      this.isActive = false;
    }
    onFocus() {
      let isFocusVisible = false;
      try {
        isFocusVisible = this.node.current.matches(":focus-visible");
      } catch (e) {
        isFocusVisible = true;
      }
      if (!isFocusVisible || !this.node.animationState)
        return;
      this.node.animationState.setActive("whileFocus", true);
      this.isActive = true;
    }
    onBlur() {
      if (!this.isActive || !this.node.animationState)
        return;
      this.node.animationState.setActive("whileFocus", false);
      this.isActive = false;
    }
    mount() {
      this.unmount = pipe(addDomEvent(this.node.current, "focus", () => this.onFocus()), addDomEvent(this.node.current, "blur", () => this.onBlur()));
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/gestures/press.mjs
  function handlePressEvent(node, event, lifecycle) {
    const { props } = node;
    if (node.animationState && props.whileTap) {
      node.animationState.setActive("whileTap", lifecycle === "Start");
    }
    const eventName = "onTap" + (lifecycle === "End" ? "" : lifecycle);
    const callback = props[eventName];
    if (callback) {
      frame.postRender(() => callback(event, extractEventInfo(event)));
    }
  }
  var PressGesture = class extends Feature {
    mount() {
      const { current } = this.node;
      if (!current)
        return;
      this.unmount = press(current, (startEvent) => {
        handlePressEvent(this.node, startEvent, "Start");
        return (endEvent, { success }) => handlePressEvent(this.node, endEvent, success ? "End" : "Cancel");
      }, { useGlobalTarget: this.node.props.globalTapTarget });
    }
    unmount() {
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/viewport/observers.mjs
  var observerCallbacks = /* @__PURE__ */ new WeakMap();
  var observers = /* @__PURE__ */ new WeakMap();
  var fireObserverCallback = (entry) => {
    const callback = observerCallbacks.get(entry.target);
    callback && callback(entry);
  };
  var fireAllObserverCallbacks = (entries) => {
    entries.forEach(fireObserverCallback);
  };
  function initIntersectionObserver({ root, ...options }) {
    const lookupRoot = root || document;
    if (!observers.has(lookupRoot)) {
      observers.set(lookupRoot, {});
    }
    const rootObservers = observers.get(lookupRoot);
    const key = JSON.stringify(options);
    if (!rootObservers[key]) {
      rootObservers[key] = new IntersectionObserver(fireAllObserverCallbacks, { root, ...options });
    }
    return rootObservers[key];
  }
  function observeIntersection(element, options, callback) {
    const rootInteresectionObserver = initIntersectionObserver(options);
    observerCallbacks.set(element, callback);
    rootInteresectionObserver.observe(element);
    return () => {
      observerCallbacks.delete(element);
      rootInteresectionObserver.unobserve(element);
    };
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/viewport/index.mjs
  var thresholdNames = {
    some: 0,
    all: 1
  };
  var InViewFeature = class extends Feature {
    constructor() {
      super(...arguments);
      this.hasEnteredView = false;
      this.isInView = false;
    }
    startObserver() {
      this.unmount();
      const { viewport = {} } = this.node.getProps();
      const { root, margin: rootMargin, amount = "some", once } = viewport;
      const options = {
        root: root ? root.current : void 0,
        rootMargin,
        threshold: typeof amount === "number" ? amount : thresholdNames[amount]
      };
      const onIntersectionUpdate = (entry) => {
        const { isIntersecting } = entry;
        if (this.isInView === isIntersecting)
          return;
        this.isInView = isIntersecting;
        if (once && !isIntersecting && this.hasEnteredView) {
          return;
        } else if (isIntersecting) {
          this.hasEnteredView = true;
        }
        if (this.node.animationState) {
          this.node.animationState.setActive("whileInView", isIntersecting);
        }
        const { onViewportEnter, onViewportLeave } = this.node.getProps();
        const callback = isIntersecting ? onViewportEnter : onViewportLeave;
        callback && callback(entry);
      };
      return observeIntersection(this.node.current, options, onIntersectionUpdate);
    }
    mount() {
      this.startObserver();
    }
    update() {
      if (typeof IntersectionObserver === "undefined")
        return;
      const { props, prevProps } = this.node;
      const hasOptionsChanged = ["amount", "margin", "root"].some(hasViewportOptionChanged(props, prevProps));
      if (hasOptionsChanged) {
        this.startObserver();
      }
    }
    unmount() {
    }
  };
  function hasViewportOptionChanged({ viewport = {} }, { viewport: prevViewport = {} } = {}) {
    return (name) => viewport[name] !== prevViewport[name];
  }

  // ../../../node_modules/framer-motion/dist/es/motion/features/gestures.mjs
  var gestureAnimations = {
    inView: {
      Feature: InViewFeature
    },
    tap: {
      Feature: PressGesture
    },
    focus: {
      Feature: FocusGesture
    },
    hover: {
      Feature: HoverGesture
    }
  };

  // ../../../node_modules/framer-motion/dist/es/motion/features/layout.mjs
  var layout = {
    layout: {
      ProjectionNode: HTMLProjectionNode,
      MeasureLayout
    }
  };

  // ../../../node_modules/framer-motion/dist/es/utils/reduced-motion/state.mjs
  var prefersReducedMotion = { current: null };
  var hasReducedMotionListener = { current: false };

  // ../../../node_modules/framer-motion/dist/es/utils/reduced-motion/index.mjs
  function initPrefersReducedMotion() {
    hasReducedMotionListener.current = true;
    if (!isBrowser)
      return;
    if (window.matchMedia) {
      const motionMediaQuery = window.matchMedia("(prefers-reduced-motion)");
      const setReducedMotionPreferences = () => prefersReducedMotion.current = motionMediaQuery.matches;
      motionMediaQuery.addListener(setReducedMotionPreferences);
      setReducedMotionPreferences();
    } else {
      prefersReducedMotion.current = false;
    }
  }

  // ../../../node_modules/framer-motion/dist/es/render/dom/value-types/find.mjs
  var valueTypes = [...dimensionValueTypes, color, complex];
  var findValueType = (v) => valueTypes.find(testValueType(v));

  // ../../../node_modules/framer-motion/dist/es/render/store.mjs
  var visualElementStore = /* @__PURE__ */ new WeakMap();

  // ../../../node_modules/framer-motion/dist/es/render/utils/motion-values.mjs
  function updateMotionValuesFromProps(element, next, prev) {
    for (const key in next) {
      const nextValue = next[key];
      const prevValue = prev[key];
      if (isMotionValue(nextValue)) {
        element.addValue(key, nextValue);
        if (true) {
          warnOnce(nextValue.version === "11.18.2", `Attempting to mix Motion versions ${nextValue.version} with 11.18.2 may not work as expected.`);
        }
      } else if (isMotionValue(prevValue)) {
        element.addValue(key, motionValue(nextValue, { owner: element }));
      } else if (prevValue !== nextValue) {
        if (element.hasValue(key)) {
          const existingValue = element.getValue(key);
          if (existingValue.liveStyle === true) {
            existingValue.jump(nextValue);
          } else if (!existingValue.hasAnimated) {
            existingValue.set(nextValue);
          }
        } else {
          const latestValue = element.getStaticValue(key);
          element.addValue(key, motionValue(latestValue !== void 0 ? latestValue : nextValue, { owner: element }));
        }
      }
    }
    for (const key in prev) {
      if (next[key] === void 0)
        element.removeValue(key);
    }
    return next;
  }

  // ../../../node_modules/framer-motion/dist/es/render/VisualElement.mjs
  var propEventHandlers = [
    "AnimationStart",
    "AnimationComplete",
    "Update",
    "BeforeLayoutMeasure",
    "LayoutMeasure",
    "LayoutAnimationStart",
    "LayoutAnimationComplete"
  ];
  var VisualElement = class {
    /**
     * This method takes React props and returns found MotionValues. For example, HTML
     * MotionValues will be found within the style prop, whereas for Three.js within attribute arrays.
     *
     * This isn't an abstract method as it needs calling in the constructor, but it is
     * intended to be one.
     */
    scrapeMotionValuesFromProps(_props, _prevProps, _visualElement) {
      return {};
    }
    constructor({ parent, props, presenceContext, reducedMotionConfig, blockInitialAnimation, visualState }, options = {}) {
      this.current = null;
      this.children = /* @__PURE__ */ new Set();
      this.isVariantNode = false;
      this.isControllingVariants = false;
      this.shouldReduceMotion = null;
      this.values = /* @__PURE__ */ new Map();
      this.KeyframeResolver = KeyframeResolver;
      this.features = {};
      this.valueSubscriptions = /* @__PURE__ */ new Map();
      this.prevMotionValues = {};
      this.events = {};
      this.propEventSubscriptions = {};
      this.notifyUpdate = () => this.notify("Update", this.latestValues);
      this.render = () => {
        if (!this.current)
          return;
        this.triggerBuild();
        this.renderInstance(this.current, this.renderState, this.props.style, this.projection);
      };
      this.renderScheduledAt = 0;
      this.scheduleRender = () => {
        const now2 = time.now();
        if (this.renderScheduledAt < now2) {
          this.renderScheduledAt = now2;
          frame.render(this.render, false, true);
        }
      };
      const { latestValues, renderState, onUpdate } = visualState;
      this.onUpdate = onUpdate;
      this.latestValues = latestValues;
      this.baseTarget = { ...latestValues };
      this.initialValues = props.initial ? { ...latestValues } : {};
      this.renderState = renderState;
      this.parent = parent;
      this.props = props;
      this.presenceContext = presenceContext;
      this.depth = parent ? parent.depth + 1 : 0;
      this.reducedMotionConfig = reducedMotionConfig;
      this.options = options;
      this.blockInitialAnimation = Boolean(blockInitialAnimation);
      this.isControllingVariants = isControllingVariants(props);
      this.isVariantNode = isVariantNode(props);
      if (this.isVariantNode) {
        this.variantChildren = /* @__PURE__ */ new Set();
      }
      this.manuallyAnimateOnMount = Boolean(parent && parent.current);
      const { willChange, ...initialMotionValues } = this.scrapeMotionValuesFromProps(props, {}, this);
      for (const key in initialMotionValues) {
        const value = initialMotionValues[key];
        if (latestValues[key] !== void 0 && isMotionValue(value)) {
          value.set(latestValues[key], false);
        }
      }
    }
    mount(instance) {
      this.current = instance;
      visualElementStore.set(instance, this);
      if (this.projection && !this.projection.instance) {
        this.projection.mount(instance);
      }
      if (this.parent && this.isVariantNode && !this.isControllingVariants) {
        this.removeFromVariantTree = this.parent.addVariantChild(this);
      }
      this.values.forEach((value, key) => this.bindToMotionValue(key, value));
      if (!hasReducedMotionListener.current) {
        initPrefersReducedMotion();
      }
      this.shouldReduceMotion = this.reducedMotionConfig === "never" ? false : this.reducedMotionConfig === "always" ? true : prefersReducedMotion.current;
      if (true) {
        warnOnce(this.shouldReduceMotion !== true, "You have Reduced Motion enabled on your device. Animations may not appear as expected.");
      }
      if (this.parent)
        this.parent.children.add(this);
      this.update(this.props, this.presenceContext);
    }
    unmount() {
      visualElementStore.delete(this.current);
      this.projection && this.projection.unmount();
      cancelFrame(this.notifyUpdate);
      cancelFrame(this.render);
      this.valueSubscriptions.forEach((remove) => remove());
      this.valueSubscriptions.clear();
      this.removeFromVariantTree && this.removeFromVariantTree();
      this.parent && this.parent.children.delete(this);
      for (const key in this.events) {
        this.events[key].clear();
      }
      for (const key in this.features) {
        const feature = this.features[key];
        if (feature) {
          feature.unmount();
          feature.isMounted = false;
        }
      }
      this.current = null;
    }
    bindToMotionValue(key, value) {
      if (this.valueSubscriptions.has(key)) {
        this.valueSubscriptions.get(key)();
      }
      const valueIsTransform = transformProps.has(key);
      const removeOnChange = value.on("change", (latestValue) => {
        this.latestValues[key] = latestValue;
        this.props.onUpdate && frame.preRender(this.notifyUpdate);
        if (valueIsTransform && this.projection) {
          this.projection.isTransformDirty = true;
        }
      });
      const removeOnRenderRequest = value.on("renderRequest", this.scheduleRender);
      let removeSyncCheck;
      if (window.MotionCheckAppearSync) {
        removeSyncCheck = window.MotionCheckAppearSync(this, key, value);
      }
      this.valueSubscriptions.set(key, () => {
        removeOnChange();
        removeOnRenderRequest();
        if (removeSyncCheck)
          removeSyncCheck();
        if (value.owner)
          value.stop();
      });
    }
    sortNodePosition(other) {
      if (!this.current || !this.sortInstanceNodePosition || this.type !== other.type) {
        return 0;
      }
      return this.sortInstanceNodePosition(this.current, other.current);
    }
    updateFeatures() {
      let key = "animation";
      for (key in featureDefinitions) {
        const featureDefinition = featureDefinitions[key];
        if (!featureDefinition)
          continue;
        const { isEnabled, Feature: FeatureConstructor } = featureDefinition;
        if (!this.features[key] && FeatureConstructor && isEnabled(this.props)) {
          this.features[key] = new FeatureConstructor(this);
        }
        if (this.features[key]) {
          const feature = this.features[key];
          if (feature.isMounted) {
            feature.update();
          } else {
            feature.mount();
            feature.isMounted = true;
          }
        }
      }
    }
    triggerBuild() {
      this.build(this.renderState, this.latestValues, this.props);
    }
    /**
     * Measure the current viewport box with or without transforms.
     * Only measures axis-aligned boxes, rotate and skew must be manually
     * removed with a re-render to work.
     */
    measureViewportBox() {
      return this.current ? this.measureInstanceViewportBox(this.current, this.props) : createBox();
    }
    getStaticValue(key) {
      return this.latestValues[key];
    }
    setStaticValue(key, value) {
      this.latestValues[key] = value;
    }
    /**
     * Update the provided props. Ensure any newly-added motion values are
     * added to our map, old ones removed, and listeners updated.
     */
    update(props, presenceContext) {
      if (props.transformTemplate || this.props.transformTemplate) {
        this.scheduleRender();
      }
      this.prevProps = this.props;
      this.props = props;
      this.prevPresenceContext = this.presenceContext;
      this.presenceContext = presenceContext;
      for (let i = 0; i < propEventHandlers.length; i++) {
        const key = propEventHandlers[i];
        if (this.propEventSubscriptions[key]) {
          this.propEventSubscriptions[key]();
          delete this.propEventSubscriptions[key];
        }
        const listenerName = "on" + key;
        const listener = props[listenerName];
        if (listener) {
          this.propEventSubscriptions[key] = this.on(key, listener);
        }
      }
      this.prevMotionValues = updateMotionValuesFromProps(this, this.scrapeMotionValuesFromProps(props, this.prevProps, this), this.prevMotionValues);
      if (this.handleChildMotionValue) {
        this.handleChildMotionValue();
      }
      this.onUpdate && this.onUpdate(this);
    }
    getProps() {
      return this.props;
    }
    /**
     * Returns the variant definition with a given name.
     */
    getVariant(name) {
      return this.props.variants ? this.props.variants[name] : void 0;
    }
    /**
     * Returns the defined default transition on this component.
     */
    getDefaultTransition() {
      return this.props.transition;
    }
    getTransformPagePoint() {
      return this.props.transformPagePoint;
    }
    getClosestVariantNode() {
      return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : void 0;
    }
    /**
     * Add a child visual element to our set of children.
     */
    addVariantChild(child) {
      const closestVariantNode = this.getClosestVariantNode();
      if (closestVariantNode) {
        closestVariantNode.variantChildren && closestVariantNode.variantChildren.add(child);
        return () => closestVariantNode.variantChildren.delete(child);
      }
    }
    /**
     * Add a motion value and bind it to this visual element.
     */
    addValue(key, value) {
      const existingValue = this.values.get(key);
      if (value !== existingValue) {
        if (existingValue)
          this.removeValue(key);
        this.bindToMotionValue(key, value);
        this.values.set(key, value);
        this.latestValues[key] = value.get();
      }
    }
    /**
     * Remove a motion value and unbind any active subscriptions.
     */
    removeValue(key) {
      this.values.delete(key);
      const unsubscribe = this.valueSubscriptions.get(key);
      if (unsubscribe) {
        unsubscribe();
        this.valueSubscriptions.delete(key);
      }
      delete this.latestValues[key];
      this.removeValueFromRenderState(key, this.renderState);
    }
    /**
     * Check whether we have a motion value for this key
     */
    hasValue(key) {
      return this.values.has(key);
    }
    getValue(key, defaultValue) {
      if (this.props.values && this.props.values[key]) {
        return this.props.values[key];
      }
      let value = this.values.get(key);
      if (value === void 0 && defaultValue !== void 0) {
        value = motionValue(defaultValue === null ? void 0 : defaultValue, { owner: this });
        this.addValue(key, value);
      }
      return value;
    }
    /**
     * If we're trying to animate to a previously unencountered value,
     * we need to check for it in our state and as a last resort read it
     * directly from the instance (which might have performance implications).
     */
    readValue(key, target) {
      var _a;
      let value = this.latestValues[key] !== void 0 || !this.current ? this.latestValues[key] : (_a = this.getBaseTargetFromProps(this.props, key)) !== null && _a !== void 0 ? _a : this.readValueFromInstance(this.current, key, this.options);
      if (value !== void 0 && value !== null) {
        if (typeof value === "string" && (isNumericalString(value) || isZeroValueString(value))) {
          value = parseFloat(value);
        } else if (!findValueType(value) && complex.test(target)) {
          value = getAnimatableNone2(key, target);
        }
        this.setBaseTarget(key, isMotionValue(value) ? value.get() : value);
      }
      return isMotionValue(value) ? value.get() : value;
    }
    /**
     * Set the base target to later animate back to. This is currently
     * only hydrated on creation and when we first read a value.
     */
    setBaseTarget(key, value) {
      this.baseTarget[key] = value;
    }
    /**
     * Find the base target for a value thats been removed from all animation
     * props.
     */
    getBaseTarget(key) {
      var _a;
      const { initial } = this.props;
      let valueFromInitial;
      if (typeof initial === "string" || typeof initial === "object") {
        const variant = resolveVariantFromProps(this.props, initial, (_a = this.presenceContext) === null || _a === void 0 ? void 0 : _a.custom);
        if (variant) {
          valueFromInitial = variant[key];
        }
      }
      if (initial && valueFromInitial !== void 0) {
        return valueFromInitial;
      }
      const target = this.getBaseTargetFromProps(this.props, key);
      if (target !== void 0 && !isMotionValue(target))
        return target;
      return this.initialValues[key] !== void 0 && valueFromInitial === void 0 ? void 0 : this.baseTarget[key];
    }
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = new SubscriptionManager();
      }
      return this.events[eventName].add(callback);
    }
    notify(eventName, ...args) {
      if (this.events[eventName]) {
        this.events[eventName].notify(...args);
      }
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/DOMVisualElement.mjs
  var DOMVisualElement = class extends VisualElement {
    constructor() {
      super(...arguments);
      this.KeyframeResolver = DOMKeyframesResolver;
    }
    sortInstanceNodePosition(a, b) {
      return a.compareDocumentPosition(b) & 2 ? 1 : -1;
    }
    getBaseTargetFromProps(props, key) {
      return props.style ? props.style[key] : void 0;
    }
    removeValueFromRenderState(key, { vars, style }) {
      delete vars[key];
      delete style[key];
    }
    handleChildMotionValue() {
      if (this.childSubscription) {
        this.childSubscription();
        delete this.childSubscription;
      }
      const { children } = this.props;
      if (isMotionValue(children)) {
        this.childSubscription = children.on("change", (latest) => {
          if (this.current) {
            this.current.textContent = `${latest}`;
          }
        });
      }
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/html/HTMLVisualElement.mjs
  function getComputedStyle(element) {
    return window.getComputedStyle(element);
  }
  var HTMLVisualElement = class extends DOMVisualElement {
    constructor() {
      super(...arguments);
      this.type = "html";
      this.renderInstance = renderHTML;
    }
    readValueFromInstance(instance, key) {
      if (transformProps.has(key)) {
        const defaultType = getDefaultValueType(key);
        return defaultType ? defaultType.default || 0 : 0;
      } else {
        const computedStyle = getComputedStyle(instance);
        const value = (isCSSVariableName(key) ? computedStyle.getPropertyValue(key) : computedStyle[key]) || 0;
        return typeof value === "string" ? value.trim() : value;
      }
    }
    measureInstanceViewportBox(instance, { transformPagePoint }) {
      return measureViewportBox(instance, transformPagePoint);
    }
    build(renderState, latestValues, props) {
      buildHTMLStyles(renderState, latestValues, props.transformTemplate);
    }
    scrapeMotionValuesFromProps(props, prevProps, visualElement) {
      return scrapeMotionValuesFromProps(props, prevProps, visualElement);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/svg/SVGVisualElement.mjs
  var SVGVisualElement = class extends DOMVisualElement {
    constructor() {
      super(...arguments);
      this.type = "svg";
      this.isSVGTag = false;
      this.measureInstanceViewportBox = createBox;
    }
    getBaseTargetFromProps(props, key) {
      return props[key];
    }
    readValueFromInstance(instance, key) {
      if (transformProps.has(key)) {
        const defaultType = getDefaultValueType(key);
        return defaultType ? defaultType.default || 0 : 0;
      }
      key = !camelCaseAttributes.has(key) ? camelToDash(key) : key;
      return instance.getAttribute(key);
    }
    scrapeMotionValuesFromProps(props, prevProps, visualElement) {
      return scrapeMotionValuesFromProps2(props, prevProps, visualElement);
    }
    build(renderState, latestValues, props) {
      buildSVGAttrs(renderState, latestValues, this.isSVGTag, props.transformTemplate);
    }
    renderInstance(instance, renderState, styleProp, projection) {
      renderSVG(instance, renderState, styleProp, projection);
    }
    mount(instance) {
      this.isSVGTag = isSVGTag(instance.tagName);
      super.mount(instance);
    }
  };

  // ../../../node_modules/framer-motion/dist/es/render/dom/create-visual-element.mjs
  var createDomVisualElement = (Component2, options) => {
    return isSVGComponent(Component2) ? new SVGVisualElement(options) : new HTMLVisualElement(options, {
      allowProjection: Component2 !== Fragment
    });
  };

  // ../../../node_modules/framer-motion/dist/es/render/components/motion/create.mjs
  var createMotionComponent = /* @__PURE__ */ createMotionComponentFactory({
    ...animations,
    ...gestureAnimations,
    ...drag,
    ...layout
  }, createDomVisualElement);

  // ../../../node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs
  var motion = /* @__PURE__ */ createDOMMotionComponentProxy(createMotionComponent);

  // ../../../node_modules/clsx/dist/clsx.mjs
  function r(e) {
    var t, f, n = "";
    if ("string" == typeof e || "number" == typeof e) n += e;
    else if ("object" == typeof e) if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
    } else for (f in e) e[f] && (n && (n += " "), n += f);
    return n;
  }
  function clsx() {
    for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
    return n;
  }

  // ../../../node_modules/tailwind-merge/dist/bundle-mjs.mjs
  var CLASS_PART_SEPARATOR = "-";
  var createClassGroupUtils = (config) => {
    const classMap = createClassMap(config);
    const {
      conflictingClassGroups,
      conflictingClassGroupModifiers
    } = config;
    const getClassGroupId = (className) => {
      const classParts = className.split(CLASS_PART_SEPARATOR);
      if (classParts[0] === "" && classParts.length !== 1) {
        classParts.shift();
      }
      return getGroupRecursive(classParts, classMap) || getGroupIdForArbitraryProperty(className);
    };
    const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
      const conflicts = conflictingClassGroups[classGroupId] || [];
      if (hasPostfixModifier && conflictingClassGroupModifiers[classGroupId]) {
        return [...conflicts, ...conflictingClassGroupModifiers[classGroupId]];
      }
      return conflicts;
    };
    return {
      getClassGroupId,
      getConflictingClassGroupIds
    };
  };
  var getGroupRecursive = (classParts, classPartObject) => {
    if (classParts.length === 0) {
      return classPartObject.classGroupId;
    }
    const currentClassPart = classParts[0];
    const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
    const classGroupFromNextClassPart = nextClassPartObject ? getGroupRecursive(classParts.slice(1), nextClassPartObject) : void 0;
    if (classGroupFromNextClassPart) {
      return classGroupFromNextClassPart;
    }
    if (classPartObject.validators.length === 0) {
      return void 0;
    }
    const classRest = classParts.join(CLASS_PART_SEPARATOR);
    return classPartObject.validators.find(({
      validator
    }) => validator(classRest))?.classGroupId;
  };
  var arbitraryPropertyRegex = /^\[(.+)\]$/;
  var getGroupIdForArbitraryProperty = (className) => {
    if (arbitraryPropertyRegex.test(className)) {
      const arbitraryPropertyClassName = arbitraryPropertyRegex.exec(className)[1];
      const property = arbitraryPropertyClassName?.substring(0, arbitraryPropertyClassName.indexOf(":"));
      if (property) {
        return "arbitrary.." + property;
      }
    }
  };
  var createClassMap = (config) => {
    const {
      theme: theme2,
      prefix
    } = config;
    const classMap = {
      nextPart: /* @__PURE__ */ new Map(),
      validators: []
    };
    const prefixedClassGroupEntries = getPrefixedClassGroupEntries(Object.entries(config.classGroups), prefix);
    prefixedClassGroupEntries.forEach(([classGroupId, classGroup]) => {
      processClassesRecursively(classGroup, classMap, classGroupId, theme2);
    });
    return classMap;
  };
  var processClassesRecursively = (classGroup, classPartObject, classGroupId, theme2) => {
    classGroup.forEach((classDefinition) => {
      if (typeof classDefinition === "string") {
        const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
        classPartObjectToEdit.classGroupId = classGroupId;
        return;
      }
      if (typeof classDefinition === "function") {
        if (isThemeGetter(classDefinition)) {
          processClassesRecursively(classDefinition(theme2), classPartObject, classGroupId, theme2);
          return;
        }
        classPartObject.validators.push({
          validator: classDefinition,
          classGroupId
        });
        return;
      }
      Object.entries(classDefinition).forEach(([key, classGroup2]) => {
        processClassesRecursively(classGroup2, getPart(classPartObject, key), classGroupId, theme2);
      });
    });
  };
  var getPart = (classPartObject, path) => {
    let currentClassPartObject = classPartObject;
    path.split(CLASS_PART_SEPARATOR).forEach((pathPart) => {
      if (!currentClassPartObject.nextPart.has(pathPart)) {
        currentClassPartObject.nextPart.set(pathPart, {
          nextPart: /* @__PURE__ */ new Map(),
          validators: []
        });
      }
      currentClassPartObject = currentClassPartObject.nextPart.get(pathPart);
    });
    return currentClassPartObject;
  };
  var isThemeGetter = (func) => func.isThemeGetter;
  var getPrefixedClassGroupEntries = (classGroupEntries, prefix) => {
    if (!prefix) {
      return classGroupEntries;
    }
    return classGroupEntries.map(([classGroupId, classGroup]) => {
      const prefixedClassGroup = classGroup.map((classDefinition) => {
        if (typeof classDefinition === "string") {
          return prefix + classDefinition;
        }
        if (typeof classDefinition === "object") {
          return Object.fromEntries(Object.entries(classDefinition).map(([key, value]) => [prefix + key, value]));
        }
        return classDefinition;
      });
      return [classGroupId, prefixedClassGroup];
    });
  };
  var createLruCache = (maxCacheSize) => {
    if (maxCacheSize < 1) {
      return {
        get: () => void 0,
        set: () => {
        }
      };
    }
    let cacheSize = 0;
    let cache = /* @__PURE__ */ new Map();
    let previousCache = /* @__PURE__ */ new Map();
    const update = (key, value) => {
      cache.set(key, value);
      cacheSize++;
      if (cacheSize > maxCacheSize) {
        cacheSize = 0;
        previousCache = cache;
        cache = /* @__PURE__ */ new Map();
      }
    };
    return {
      get(key) {
        let value = cache.get(key);
        if (value !== void 0) {
          return value;
        }
        if ((value = previousCache.get(key)) !== void 0) {
          update(key, value);
          return value;
        }
      },
      set(key, value) {
        if (cache.has(key)) {
          cache.set(key, value);
        } else {
          update(key, value);
        }
      }
    };
  };
  var IMPORTANT_MODIFIER = "!";
  var createParseClassName = (config) => {
    const {
      separator,
      experimentalParseClassName
    } = config;
    const isSeparatorSingleCharacter = separator.length === 1;
    const firstSeparatorCharacter = separator[0];
    const separatorLength = separator.length;
    const parseClassName = (className) => {
      const modifiers = [];
      let bracketDepth = 0;
      let modifierStart = 0;
      let postfixModifierPosition;
      for (let index = 0; index < className.length; index++) {
        let currentCharacter = className[index];
        if (bracketDepth === 0) {
          if (currentCharacter === firstSeparatorCharacter && (isSeparatorSingleCharacter || className.slice(index, index + separatorLength) === separator)) {
            modifiers.push(className.slice(modifierStart, index));
            modifierStart = index + separatorLength;
            continue;
          }
          if (currentCharacter === "/") {
            postfixModifierPosition = index;
            continue;
          }
        }
        if (currentCharacter === "[") {
          bracketDepth++;
        } else if (currentCharacter === "]") {
          bracketDepth--;
        }
      }
      const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.substring(modifierStart);
      const hasImportantModifier = baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER);
      const baseClassName = hasImportantModifier ? baseClassNameWithImportantModifier.substring(1) : baseClassNameWithImportantModifier;
      const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
      return {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      };
    };
    if (experimentalParseClassName) {
      return (className) => experimentalParseClassName({
        className,
        parseClassName
      });
    }
    return parseClassName;
  };
  var sortModifiers = (modifiers) => {
    if (modifiers.length <= 1) {
      return modifiers;
    }
    const sortedModifiers = [];
    let unsortedModifiers = [];
    modifiers.forEach((modifier) => {
      const isArbitraryVariant = modifier[0] === "[";
      if (isArbitraryVariant) {
        sortedModifiers.push(...unsortedModifiers.sort(), modifier);
        unsortedModifiers = [];
      } else {
        unsortedModifiers.push(modifier);
      }
    });
    sortedModifiers.push(...unsortedModifiers.sort());
    return sortedModifiers;
  };
  var createConfigUtils = (config) => ({
    cache: createLruCache(config.cacheSize),
    parseClassName: createParseClassName(config),
    ...createClassGroupUtils(config)
  });
  var SPLIT_CLASSES_REGEX = /\s+/;
  var mergeClassList = (classList, configUtils) => {
    const {
      parseClassName,
      getClassGroupId,
      getConflictingClassGroupIds
    } = configUtils;
    const classGroupsInConflict = [];
    const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
    let result = "";
    for (let index = classNames.length - 1; index >= 0; index -= 1) {
      const originalClassName = classNames[index];
      const {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      } = parseClassName(originalClassName);
      let hasPostfixModifier = Boolean(maybePostfixModifierPosition);
      let classGroupId = getClassGroupId(hasPostfixModifier ? baseClassName.substring(0, maybePostfixModifierPosition) : baseClassName);
      if (!classGroupId) {
        if (!hasPostfixModifier) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        classGroupId = getClassGroupId(baseClassName);
        if (!classGroupId) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        hasPostfixModifier = false;
      }
      const variantModifier = sortModifiers(modifiers).join(":");
      const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
      const classId = modifierId + classGroupId;
      if (classGroupsInConflict.includes(classId)) {
        continue;
      }
      classGroupsInConflict.push(classId);
      const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
      for (let i = 0; i < conflictGroups.length; ++i) {
        const group = conflictGroups[i];
        classGroupsInConflict.push(modifierId + group);
      }
      result = originalClassName + (result.length > 0 ? " " + result : result);
    }
    return result;
  };
  function twJoin() {
    let index = 0;
    let argument;
    let resolvedValue;
    let string = "";
    while (index < arguments.length) {
      if (argument = arguments[index++]) {
        if (resolvedValue = toValue(argument)) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  }
  var toValue = (mix2) => {
    if (typeof mix2 === "string") {
      return mix2;
    }
    let resolvedValue;
    let string = "";
    for (let k = 0; k < mix2.length; k++) {
      if (mix2[k]) {
        if (resolvedValue = toValue(mix2[k])) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  function createTailwindMerge(createConfigFirst, ...createConfigRest) {
    let configUtils;
    let cacheGet;
    let cacheSet;
    let functionToCall = initTailwindMerge;
    function initTailwindMerge(classList) {
      const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
      configUtils = createConfigUtils(config);
      cacheGet = configUtils.cache.get;
      cacheSet = configUtils.cache.set;
      functionToCall = tailwindMerge;
      return tailwindMerge(classList);
    }
    function tailwindMerge(classList) {
      const cachedResult = cacheGet(classList);
      if (cachedResult) {
        return cachedResult;
      }
      const result = mergeClassList(classList, configUtils);
      cacheSet(classList, result);
      return result;
    }
    return function callTailwindMerge() {
      return functionToCall(twJoin.apply(null, arguments));
    };
  }
  var fromTheme = (key) => {
    const themeGetter = (theme2) => theme2[key] || [];
    themeGetter.isThemeGetter = true;
    return themeGetter;
  };
  var arbitraryValueRegex = /^\[(?:([a-z-]+):)?(.+)\]$/i;
  var fractionRegex = /^\d+\/\d+$/;
  var stringLengths = /* @__PURE__ */ new Set(["px", "full", "screen"]);
  var tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  var lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  var colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/;
  var shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  var imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  var isLength = (value) => isNumber(value) || stringLengths.has(value) || fractionRegex.test(value);
  var isArbitraryLength = (value) => getIsArbitraryValue(value, "length", isLengthOnly);
  var isNumber = (value) => Boolean(value) && !Number.isNaN(Number(value));
  var isArbitraryNumber = (value) => getIsArbitraryValue(value, "number", isNumber);
  var isInteger = (value) => Boolean(value) && Number.isInteger(Number(value));
  var isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
  var isArbitraryValue = (value) => arbitraryValueRegex.test(value);
  var isTshirtSize = (value) => tshirtUnitRegex.test(value);
  var sizeLabels = /* @__PURE__ */ new Set(["length", "size", "percentage"]);
  var isArbitrarySize = (value) => getIsArbitraryValue(value, sizeLabels, isNever);
  var isArbitraryPosition = (value) => getIsArbitraryValue(value, "position", isNever);
  var imageLabels = /* @__PURE__ */ new Set(["image", "url"]);
  var isArbitraryImage = (value) => getIsArbitraryValue(value, imageLabels, isImage);
  var isArbitraryShadow = (value) => getIsArbitraryValue(value, "", isShadow);
  var isAny = () => true;
  var getIsArbitraryValue = (value, label, testValue) => {
    const result = arbitraryValueRegex.exec(value);
    if (result) {
      if (result[1]) {
        return typeof label === "string" ? result[1] === label : label.has(result[1]);
      }
      return testValue(result[2]);
    }
    return false;
  };
  var isLengthOnly = (value) => (
    // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
    // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
    // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
    lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)
  );
  var isNever = () => false;
  var isShadow = (value) => shadowRegex.test(value);
  var isImage = (value) => imageRegex.test(value);
  var getDefaultConfig = () => {
    const colors3 = fromTheme("colors");
    const spacing3 = fromTheme("spacing");
    const blur = fromTheme("blur");
    const brightness = fromTheme("brightness");
    const borderColor = fromTheme("borderColor");
    const borderRadius3 = fromTheme("borderRadius");
    const borderSpacing = fromTheme("borderSpacing");
    const borderWidth = fromTheme("borderWidth");
    const contrast = fromTheme("contrast");
    const grayscale = fromTheme("grayscale");
    const hueRotate = fromTheme("hueRotate");
    const invert = fromTheme("invert");
    const gap = fromTheme("gap");
    const gradientColorStops = fromTheme("gradientColorStops");
    const gradientColorStopPositions = fromTheme("gradientColorStopPositions");
    const inset = fromTheme("inset");
    const margin = fromTheme("margin");
    const opacity = fromTheme("opacity");
    const padding = fromTheme("padding");
    const saturate = fromTheme("saturate");
    const scale2 = fromTheme("scale");
    const sepia = fromTheme("sepia");
    const skew = fromTheme("skew");
    const space = fromTheme("space");
    const translate = fromTheme("translate");
    const getOverscroll = () => ["auto", "contain", "none"];
    const getOverflow = () => ["auto", "hidden", "clip", "visible", "scroll"];
    const getSpacingWithAutoAndArbitrary = () => ["auto", isArbitraryValue, spacing3];
    const getSpacingWithArbitrary = () => [isArbitraryValue, spacing3];
    const getLengthWithEmptyAndArbitrary = () => ["", isLength, isArbitraryLength];
    const getNumberWithAutoAndArbitrary = () => ["auto", isNumber, isArbitraryValue];
    const getPositions = () => ["bottom", "center", "left", "left-bottom", "left-top", "right", "right-bottom", "right-top", "top"];
    const getLineStyles = () => ["solid", "dashed", "dotted", "double", "none"];
    const getBlendModes = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    const getAlign = () => ["start", "end", "center", "between", "around", "evenly", "stretch"];
    const getZeroAndEmpty = () => ["", "0", isArbitraryValue];
    const getBreaks = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"];
    const getNumberAndArbitrary = () => [isNumber, isArbitraryValue];
    return {
      cacheSize: 500,
      separator: ":",
      theme: {
        colors: [isAny],
        spacing: [isLength, isArbitraryLength],
        blur: ["none", "", isTshirtSize, isArbitraryValue],
        brightness: getNumberAndArbitrary(),
        borderColor: [colors3],
        borderRadius: ["none", "", "full", isTshirtSize, isArbitraryValue],
        borderSpacing: getSpacingWithArbitrary(),
        borderWidth: getLengthWithEmptyAndArbitrary(),
        contrast: getNumberAndArbitrary(),
        grayscale: getZeroAndEmpty(),
        hueRotate: getNumberAndArbitrary(),
        invert: getZeroAndEmpty(),
        gap: getSpacingWithArbitrary(),
        gradientColorStops: [colors3],
        gradientColorStopPositions: [isPercent, isArbitraryLength],
        inset: getSpacingWithAutoAndArbitrary(),
        margin: getSpacingWithAutoAndArbitrary(),
        opacity: getNumberAndArbitrary(),
        padding: getSpacingWithArbitrary(),
        saturate: getNumberAndArbitrary(),
        scale: getNumberAndArbitrary(),
        sepia: getZeroAndEmpty(),
        skew: getNumberAndArbitrary(),
        space: getSpacingWithArbitrary(),
        translate: getSpacingWithArbitrary()
      },
      classGroups: {
        // Layout
        /**
         * Aspect Ratio
         * @see https://tailwindcss.com/docs/aspect-ratio
         */
        aspect: [{
          aspect: ["auto", "square", "video", isArbitraryValue]
        }],
        /**
         * Container
         * @see https://tailwindcss.com/docs/container
         */
        container: ["container"],
        /**
         * Columns
         * @see https://tailwindcss.com/docs/columns
         */
        columns: [{
          columns: [isTshirtSize]
        }],
        /**
         * Break After
         * @see https://tailwindcss.com/docs/break-after
         */
        "break-after": [{
          "break-after": getBreaks()
        }],
        /**
         * Break Before
         * @see https://tailwindcss.com/docs/break-before
         */
        "break-before": [{
          "break-before": getBreaks()
        }],
        /**
         * Break Inside
         * @see https://tailwindcss.com/docs/break-inside
         */
        "break-inside": [{
          "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
        }],
        /**
         * Box Decoration Break
         * @see https://tailwindcss.com/docs/box-decoration-break
         */
        "box-decoration": [{
          "box-decoration": ["slice", "clone"]
        }],
        /**
         * Box Sizing
         * @see https://tailwindcss.com/docs/box-sizing
         */
        box: [{
          box: ["border", "content"]
        }],
        /**
         * Display
         * @see https://tailwindcss.com/docs/display
         */
        display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
        /**
         * Floats
         * @see https://tailwindcss.com/docs/float
         */
        float: [{
          float: ["right", "left", "none", "start", "end"]
        }],
        /**
         * Clear
         * @see https://tailwindcss.com/docs/clear
         */
        clear: [{
          clear: ["left", "right", "both", "none", "start", "end"]
        }],
        /**
         * Isolation
         * @see https://tailwindcss.com/docs/isolation
         */
        isolation: ["isolate", "isolation-auto"],
        /**
         * Object Fit
         * @see https://tailwindcss.com/docs/object-fit
         */
        "object-fit": [{
          object: ["contain", "cover", "fill", "none", "scale-down"]
        }],
        /**
         * Object Position
         * @see https://tailwindcss.com/docs/object-position
         */
        "object-position": [{
          object: [...getPositions(), isArbitraryValue]
        }],
        /**
         * Overflow
         * @see https://tailwindcss.com/docs/overflow
         */
        overflow: [{
          overflow: getOverflow()
        }],
        /**
         * Overflow X
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-x": [{
          "overflow-x": getOverflow()
        }],
        /**
         * Overflow Y
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-y": [{
          "overflow-y": getOverflow()
        }],
        /**
         * Overscroll Behavior
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        overscroll: [{
          overscroll: getOverscroll()
        }],
        /**
         * Overscroll Behavior X
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-x": [{
          "overscroll-x": getOverscroll()
        }],
        /**
         * Overscroll Behavior Y
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-y": [{
          "overscroll-y": getOverscroll()
        }],
        /**
         * Position
         * @see https://tailwindcss.com/docs/position
         */
        position: ["static", "fixed", "absolute", "relative", "sticky"],
        /**
         * Top / Right / Bottom / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        inset: [{
          inset: [inset]
        }],
        /**
         * Right / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-x": [{
          "inset-x": [inset]
        }],
        /**
         * Top / Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-y": [{
          "inset-y": [inset]
        }],
        /**
         * Start
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        start: [{
          start: [inset]
        }],
        /**
         * End
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        end: [{
          end: [inset]
        }],
        /**
         * Top
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        top: [{
          top: [inset]
        }],
        /**
         * Right
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        right: [{
          right: [inset]
        }],
        /**
         * Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        bottom: [{
          bottom: [inset]
        }],
        /**
         * Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        left: [{
          left: [inset]
        }],
        /**
         * Visibility
         * @see https://tailwindcss.com/docs/visibility
         */
        visibility: ["visible", "invisible", "collapse"],
        /**
         * Z-Index
         * @see https://tailwindcss.com/docs/z-index
         */
        z: [{
          z: ["auto", isInteger, isArbitraryValue]
        }],
        // Flexbox and Grid
        /**
         * Flex Basis
         * @see https://tailwindcss.com/docs/flex-basis
         */
        basis: [{
          basis: getSpacingWithAutoAndArbitrary()
        }],
        /**
         * Flex Direction
         * @see https://tailwindcss.com/docs/flex-direction
         */
        "flex-direction": [{
          flex: ["row", "row-reverse", "col", "col-reverse"]
        }],
        /**
         * Flex Wrap
         * @see https://tailwindcss.com/docs/flex-wrap
         */
        "flex-wrap": [{
          flex: ["wrap", "wrap-reverse", "nowrap"]
        }],
        /**
         * Flex
         * @see https://tailwindcss.com/docs/flex
         */
        flex: [{
          flex: ["1", "auto", "initial", "none", isArbitraryValue]
        }],
        /**
         * Flex Grow
         * @see https://tailwindcss.com/docs/flex-grow
         */
        grow: [{
          grow: getZeroAndEmpty()
        }],
        /**
         * Flex Shrink
         * @see https://tailwindcss.com/docs/flex-shrink
         */
        shrink: [{
          shrink: getZeroAndEmpty()
        }],
        /**
         * Order
         * @see https://tailwindcss.com/docs/order
         */
        order: [{
          order: ["first", "last", "none", isInteger, isArbitraryValue]
        }],
        /**
         * Grid Template Columns
         * @see https://tailwindcss.com/docs/grid-template-columns
         */
        "grid-cols": [{
          "grid-cols": [isAny]
        }],
        /**
         * Grid Column Start / End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start-end": [{
          col: ["auto", {
            span: ["full", isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Column Start
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start": [{
          "col-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Column End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-end": [{
          "col-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Template Rows
         * @see https://tailwindcss.com/docs/grid-template-rows
         */
        "grid-rows": [{
          "grid-rows": [isAny]
        }],
        /**
         * Grid Row Start / End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start-end": [{
          row: ["auto", {
            span: [isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Row Start
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start": [{
          "row-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Row End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-end": [{
          "row-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Auto Flow
         * @see https://tailwindcss.com/docs/grid-auto-flow
         */
        "grid-flow": [{
          "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
        }],
        /**
         * Grid Auto Columns
         * @see https://tailwindcss.com/docs/grid-auto-columns
         */
        "auto-cols": [{
          "auto-cols": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Grid Auto Rows
         * @see https://tailwindcss.com/docs/grid-auto-rows
         */
        "auto-rows": [{
          "auto-rows": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Gap
         * @see https://tailwindcss.com/docs/gap
         */
        gap: [{
          gap: [gap]
        }],
        /**
         * Gap X
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-x": [{
          "gap-x": [gap]
        }],
        /**
         * Gap Y
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-y": [{
          "gap-y": [gap]
        }],
        /**
         * Justify Content
         * @see https://tailwindcss.com/docs/justify-content
         */
        "justify-content": [{
          justify: ["normal", ...getAlign()]
        }],
        /**
         * Justify Items
         * @see https://tailwindcss.com/docs/justify-items
         */
        "justify-items": [{
          "justify-items": ["start", "end", "center", "stretch"]
        }],
        /**
         * Justify Self
         * @see https://tailwindcss.com/docs/justify-self
         */
        "justify-self": [{
          "justify-self": ["auto", "start", "end", "center", "stretch"]
        }],
        /**
         * Align Content
         * @see https://tailwindcss.com/docs/align-content
         */
        "align-content": [{
          content: ["normal", ...getAlign(), "baseline"]
        }],
        /**
         * Align Items
         * @see https://tailwindcss.com/docs/align-items
         */
        "align-items": [{
          items: ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Align Self
         * @see https://tailwindcss.com/docs/align-self
         */
        "align-self": [{
          self: ["auto", "start", "end", "center", "stretch", "baseline"]
        }],
        /**
         * Place Content
         * @see https://tailwindcss.com/docs/place-content
         */
        "place-content": [{
          "place-content": [...getAlign(), "baseline"]
        }],
        /**
         * Place Items
         * @see https://tailwindcss.com/docs/place-items
         */
        "place-items": [{
          "place-items": ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Place Self
         * @see https://tailwindcss.com/docs/place-self
         */
        "place-self": [{
          "place-self": ["auto", "start", "end", "center", "stretch"]
        }],
        // Spacing
        /**
         * Padding
         * @see https://tailwindcss.com/docs/padding
         */
        p: [{
          p: [padding]
        }],
        /**
         * Padding X
         * @see https://tailwindcss.com/docs/padding
         */
        px: [{
          px: [padding]
        }],
        /**
         * Padding Y
         * @see https://tailwindcss.com/docs/padding
         */
        py: [{
          py: [padding]
        }],
        /**
         * Padding Start
         * @see https://tailwindcss.com/docs/padding
         */
        ps: [{
          ps: [padding]
        }],
        /**
         * Padding End
         * @see https://tailwindcss.com/docs/padding
         */
        pe: [{
          pe: [padding]
        }],
        /**
         * Padding Top
         * @see https://tailwindcss.com/docs/padding
         */
        pt: [{
          pt: [padding]
        }],
        /**
         * Padding Right
         * @see https://tailwindcss.com/docs/padding
         */
        pr: [{
          pr: [padding]
        }],
        /**
         * Padding Bottom
         * @see https://tailwindcss.com/docs/padding
         */
        pb: [{
          pb: [padding]
        }],
        /**
         * Padding Left
         * @see https://tailwindcss.com/docs/padding
         */
        pl: [{
          pl: [padding]
        }],
        /**
         * Margin
         * @see https://tailwindcss.com/docs/margin
         */
        m: [{
          m: [margin]
        }],
        /**
         * Margin X
         * @see https://tailwindcss.com/docs/margin
         */
        mx: [{
          mx: [margin]
        }],
        /**
         * Margin Y
         * @see https://tailwindcss.com/docs/margin
         */
        my: [{
          my: [margin]
        }],
        /**
         * Margin Start
         * @see https://tailwindcss.com/docs/margin
         */
        ms: [{
          ms: [margin]
        }],
        /**
         * Margin End
         * @see https://tailwindcss.com/docs/margin
         */
        me: [{
          me: [margin]
        }],
        /**
         * Margin Top
         * @see https://tailwindcss.com/docs/margin
         */
        mt: [{
          mt: [margin]
        }],
        /**
         * Margin Right
         * @see https://tailwindcss.com/docs/margin
         */
        mr: [{
          mr: [margin]
        }],
        /**
         * Margin Bottom
         * @see https://tailwindcss.com/docs/margin
         */
        mb: [{
          mb: [margin]
        }],
        /**
         * Margin Left
         * @see https://tailwindcss.com/docs/margin
         */
        ml: [{
          ml: [margin]
        }],
        /**
         * Space Between X
         * @see https://tailwindcss.com/docs/space
         */
        "space-x": [{
          "space-x": [space]
        }],
        /**
         * Space Between X Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-x-reverse": ["space-x-reverse"],
        /**
         * Space Between Y
         * @see https://tailwindcss.com/docs/space
         */
        "space-y": [{
          "space-y": [space]
        }],
        /**
         * Space Between Y Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-y-reverse": ["space-y-reverse"],
        // Sizing
        /**
         * Width
         * @see https://tailwindcss.com/docs/width
         */
        w: [{
          w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", isArbitraryValue, spacing3]
        }],
        /**
         * Min-Width
         * @see https://tailwindcss.com/docs/min-width
         */
        "min-w": [{
          "min-w": [isArbitraryValue, spacing3, "min", "max", "fit"]
        }],
        /**
         * Max-Width
         * @see https://tailwindcss.com/docs/max-width
         */
        "max-w": [{
          "max-w": [isArbitraryValue, spacing3, "none", "full", "min", "max", "fit", "prose", {
            screen: [isTshirtSize]
          }, isTshirtSize]
        }],
        /**
         * Height
         * @see https://tailwindcss.com/docs/height
         */
        h: [{
          h: [isArbitraryValue, spacing3, "auto", "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Min-Height
         * @see https://tailwindcss.com/docs/min-height
         */
        "min-h": [{
          "min-h": [isArbitraryValue, spacing3, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Max-Height
         * @see https://tailwindcss.com/docs/max-height
         */
        "max-h": [{
          "max-h": [isArbitraryValue, spacing3, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Size
         * @see https://tailwindcss.com/docs/size
         */
        size: [{
          size: [isArbitraryValue, spacing3, "auto", "min", "max", "fit"]
        }],
        // Typography
        /**
         * Font Size
         * @see https://tailwindcss.com/docs/font-size
         */
        "font-size": [{
          text: ["base", isTshirtSize, isArbitraryLength]
        }],
        /**
         * Font Smoothing
         * @see https://tailwindcss.com/docs/font-smoothing
         */
        "font-smoothing": ["antialiased", "subpixel-antialiased"],
        /**
         * Font Style
         * @see https://tailwindcss.com/docs/font-style
         */
        "font-style": ["italic", "not-italic"],
        /**
         * Font Weight
         * @see https://tailwindcss.com/docs/font-weight
         */
        "font-weight": [{
          font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black", isArbitraryNumber]
        }],
        /**
         * Font Family
         * @see https://tailwindcss.com/docs/font-family
         */
        "font-family": [{
          font: [isAny]
        }],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-normal": ["normal-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-ordinal": ["ordinal"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-slashed-zero": ["slashed-zero"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-figure": ["lining-nums", "oldstyle-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-spacing": ["proportional-nums", "tabular-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
        /**
         * Letter Spacing
         * @see https://tailwindcss.com/docs/letter-spacing
         */
        tracking: [{
          tracking: ["tighter", "tight", "normal", "wide", "wider", "widest", isArbitraryValue]
        }],
        /**
         * Line Clamp
         * @see https://tailwindcss.com/docs/line-clamp
         */
        "line-clamp": [{
          "line-clamp": ["none", isNumber, isArbitraryNumber]
        }],
        /**
         * Line Height
         * @see https://tailwindcss.com/docs/line-height
         */
        leading: [{
          leading: ["none", "tight", "snug", "normal", "relaxed", "loose", isLength, isArbitraryValue]
        }],
        /**
         * List Style Image
         * @see https://tailwindcss.com/docs/list-style-image
         */
        "list-image": [{
          "list-image": ["none", isArbitraryValue]
        }],
        /**
         * List Style Type
         * @see https://tailwindcss.com/docs/list-style-type
         */
        "list-style-type": [{
          list: ["none", "disc", "decimal", isArbitraryValue]
        }],
        /**
         * List Style Position
         * @see https://tailwindcss.com/docs/list-style-position
         */
        "list-style-position": [{
          list: ["inside", "outside"]
        }],
        /**
         * Placeholder Color
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/placeholder-color
         */
        "placeholder-color": [{
          placeholder: [colors3]
        }],
        /**
         * Placeholder Opacity
         * @see https://tailwindcss.com/docs/placeholder-opacity
         */
        "placeholder-opacity": [{
          "placeholder-opacity": [opacity]
        }],
        /**
         * Text Alignment
         * @see https://tailwindcss.com/docs/text-align
         */
        "text-alignment": [{
          text: ["left", "center", "right", "justify", "start", "end"]
        }],
        /**
         * Text Color
         * @see https://tailwindcss.com/docs/text-color
         */
        "text-color": [{
          text: [colors3]
        }],
        /**
         * Text Opacity
         * @see https://tailwindcss.com/docs/text-opacity
         */
        "text-opacity": [{
          "text-opacity": [opacity]
        }],
        /**
         * Text Decoration
         * @see https://tailwindcss.com/docs/text-decoration
         */
        "text-decoration": ["underline", "overline", "line-through", "no-underline"],
        /**
         * Text Decoration Style
         * @see https://tailwindcss.com/docs/text-decoration-style
         */
        "text-decoration-style": [{
          decoration: [...getLineStyles(), "wavy"]
        }],
        /**
         * Text Decoration Thickness
         * @see https://tailwindcss.com/docs/text-decoration-thickness
         */
        "text-decoration-thickness": [{
          decoration: ["auto", "from-font", isLength, isArbitraryLength]
        }],
        /**
         * Text Underline Offset
         * @see https://tailwindcss.com/docs/text-underline-offset
         */
        "underline-offset": [{
          "underline-offset": ["auto", isLength, isArbitraryValue]
        }],
        /**
         * Text Decoration Color
         * @see https://tailwindcss.com/docs/text-decoration-color
         */
        "text-decoration-color": [{
          decoration: [colors3]
        }],
        /**
         * Text Transform
         * @see https://tailwindcss.com/docs/text-transform
         */
        "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
        /**
         * Text Overflow
         * @see https://tailwindcss.com/docs/text-overflow
         */
        "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
        /**
         * Text Wrap
         * @see https://tailwindcss.com/docs/text-wrap
         */
        "text-wrap": [{
          text: ["wrap", "nowrap", "balance", "pretty"]
        }],
        /**
         * Text Indent
         * @see https://tailwindcss.com/docs/text-indent
         */
        indent: [{
          indent: getSpacingWithArbitrary()
        }],
        /**
         * Vertical Alignment
         * @see https://tailwindcss.com/docs/vertical-align
         */
        "vertical-align": [{
          align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", isArbitraryValue]
        }],
        /**
         * Whitespace
         * @see https://tailwindcss.com/docs/whitespace
         */
        whitespace: [{
          whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
        }],
        /**
         * Word Break
         * @see https://tailwindcss.com/docs/word-break
         */
        break: [{
          break: ["normal", "words", "all", "keep"]
        }],
        /**
         * Hyphens
         * @see https://tailwindcss.com/docs/hyphens
         */
        hyphens: [{
          hyphens: ["none", "manual", "auto"]
        }],
        /**
         * Content
         * @see https://tailwindcss.com/docs/content
         */
        content: [{
          content: ["none", isArbitraryValue]
        }],
        // Backgrounds
        /**
         * Background Attachment
         * @see https://tailwindcss.com/docs/background-attachment
         */
        "bg-attachment": [{
          bg: ["fixed", "local", "scroll"]
        }],
        /**
         * Background Clip
         * @see https://tailwindcss.com/docs/background-clip
         */
        "bg-clip": [{
          "bg-clip": ["border", "padding", "content", "text"]
        }],
        /**
         * Background Opacity
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/background-opacity
         */
        "bg-opacity": [{
          "bg-opacity": [opacity]
        }],
        /**
         * Background Origin
         * @see https://tailwindcss.com/docs/background-origin
         */
        "bg-origin": [{
          "bg-origin": ["border", "padding", "content"]
        }],
        /**
         * Background Position
         * @see https://tailwindcss.com/docs/background-position
         */
        "bg-position": [{
          bg: [...getPositions(), isArbitraryPosition]
        }],
        /**
         * Background Repeat
         * @see https://tailwindcss.com/docs/background-repeat
         */
        "bg-repeat": [{
          bg: ["no-repeat", {
            repeat: ["", "x", "y", "round", "space"]
          }]
        }],
        /**
         * Background Size
         * @see https://tailwindcss.com/docs/background-size
         */
        "bg-size": [{
          bg: ["auto", "cover", "contain", isArbitrarySize]
        }],
        /**
         * Background Image
         * @see https://tailwindcss.com/docs/background-image
         */
        "bg-image": [{
          bg: ["none", {
            "gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, isArbitraryImage]
        }],
        /**
         * Background Color
         * @see https://tailwindcss.com/docs/background-color
         */
        "bg-color": [{
          bg: [colors3]
        }],
        /**
         * Gradient Color Stops From Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from-pos": [{
          from: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops Via Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via-pos": [{
          via: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops To Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to-pos": [{
          to: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops From
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from": [{
          from: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops Via
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via": [{
          via: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops To
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to": [{
          to: [gradientColorStops]
        }],
        // Borders
        /**
         * Border Radius
         * @see https://tailwindcss.com/docs/border-radius
         */
        rounded: [{
          rounded: [borderRadius3]
        }],
        /**
         * Border Radius Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-s": [{
          "rounded-s": [borderRadius3]
        }],
        /**
         * Border Radius End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-e": [{
          "rounded-e": [borderRadius3]
        }],
        /**
         * Border Radius Top
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-t": [{
          "rounded-t": [borderRadius3]
        }],
        /**
         * Border Radius Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-r": [{
          "rounded-r": [borderRadius3]
        }],
        /**
         * Border Radius Bottom
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-b": [{
          "rounded-b": [borderRadius3]
        }],
        /**
         * Border Radius Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-l": [{
          "rounded-l": [borderRadius3]
        }],
        /**
         * Border Radius Start Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ss": [{
          "rounded-ss": [borderRadius3]
        }],
        /**
         * Border Radius Start End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-se": [{
          "rounded-se": [borderRadius3]
        }],
        /**
         * Border Radius End End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ee": [{
          "rounded-ee": [borderRadius3]
        }],
        /**
         * Border Radius End Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-es": [{
          "rounded-es": [borderRadius3]
        }],
        /**
         * Border Radius Top Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tl": [{
          "rounded-tl": [borderRadius3]
        }],
        /**
         * Border Radius Top Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tr": [{
          "rounded-tr": [borderRadius3]
        }],
        /**
         * Border Radius Bottom Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-br": [{
          "rounded-br": [borderRadius3]
        }],
        /**
         * Border Radius Bottom Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-bl": [{
          "rounded-bl": [borderRadius3]
        }],
        /**
         * Border Width
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w": [{
          border: [borderWidth]
        }],
        /**
         * Border Width X
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-x": [{
          "border-x": [borderWidth]
        }],
        /**
         * Border Width Y
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-y": [{
          "border-y": [borderWidth]
        }],
        /**
         * Border Width Start
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-s": [{
          "border-s": [borderWidth]
        }],
        /**
         * Border Width End
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-e": [{
          "border-e": [borderWidth]
        }],
        /**
         * Border Width Top
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-t": [{
          "border-t": [borderWidth]
        }],
        /**
         * Border Width Right
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-r": [{
          "border-r": [borderWidth]
        }],
        /**
         * Border Width Bottom
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-b": [{
          "border-b": [borderWidth]
        }],
        /**
         * Border Width Left
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-l": [{
          "border-l": [borderWidth]
        }],
        /**
         * Border Opacity
         * @see https://tailwindcss.com/docs/border-opacity
         */
        "border-opacity": [{
          "border-opacity": [opacity]
        }],
        /**
         * Border Style
         * @see https://tailwindcss.com/docs/border-style
         */
        "border-style": [{
          border: [...getLineStyles(), "hidden"]
        }],
        /**
         * Divide Width X
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x": [{
          "divide-x": [borderWidth]
        }],
        /**
         * Divide Width X Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x-reverse": ["divide-x-reverse"],
        /**
         * Divide Width Y
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y": [{
          "divide-y": [borderWidth]
        }],
        /**
         * Divide Width Y Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y-reverse": ["divide-y-reverse"],
        /**
         * Divide Opacity
         * @see https://tailwindcss.com/docs/divide-opacity
         */
        "divide-opacity": [{
          "divide-opacity": [opacity]
        }],
        /**
         * Divide Style
         * @see https://tailwindcss.com/docs/divide-style
         */
        "divide-style": [{
          divide: getLineStyles()
        }],
        /**
         * Border Color
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color": [{
          border: [borderColor]
        }],
        /**
         * Border Color X
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-x": [{
          "border-x": [borderColor]
        }],
        /**
         * Border Color Y
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-y": [{
          "border-y": [borderColor]
        }],
        /**
         * Border Color S
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-s": [{
          "border-s": [borderColor]
        }],
        /**
         * Border Color E
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-e": [{
          "border-e": [borderColor]
        }],
        /**
         * Border Color Top
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-t": [{
          "border-t": [borderColor]
        }],
        /**
         * Border Color Right
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-r": [{
          "border-r": [borderColor]
        }],
        /**
         * Border Color Bottom
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-b": [{
          "border-b": [borderColor]
        }],
        /**
         * Border Color Left
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-l": [{
          "border-l": [borderColor]
        }],
        /**
         * Divide Color
         * @see https://tailwindcss.com/docs/divide-color
         */
        "divide-color": [{
          divide: [borderColor]
        }],
        /**
         * Outline Style
         * @see https://tailwindcss.com/docs/outline-style
         */
        "outline-style": [{
          outline: ["", ...getLineStyles()]
        }],
        /**
         * Outline Offset
         * @see https://tailwindcss.com/docs/outline-offset
         */
        "outline-offset": [{
          "outline-offset": [isLength, isArbitraryValue]
        }],
        /**
         * Outline Width
         * @see https://tailwindcss.com/docs/outline-width
         */
        "outline-w": [{
          outline: [isLength, isArbitraryLength]
        }],
        /**
         * Outline Color
         * @see https://tailwindcss.com/docs/outline-color
         */
        "outline-color": [{
          outline: [colors3]
        }],
        /**
         * Ring Width
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w": [{
          ring: getLengthWithEmptyAndArbitrary()
        }],
        /**
         * Ring Width Inset
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w-inset": ["ring-inset"],
        /**
         * Ring Color
         * @see https://tailwindcss.com/docs/ring-color
         */
        "ring-color": [{
          ring: [colors3]
        }],
        /**
         * Ring Opacity
         * @see https://tailwindcss.com/docs/ring-opacity
         */
        "ring-opacity": [{
          "ring-opacity": [opacity]
        }],
        /**
         * Ring Offset Width
         * @see https://tailwindcss.com/docs/ring-offset-width
         */
        "ring-offset-w": [{
          "ring-offset": [isLength, isArbitraryLength]
        }],
        /**
         * Ring Offset Color
         * @see https://tailwindcss.com/docs/ring-offset-color
         */
        "ring-offset-color": [{
          "ring-offset": [colors3]
        }],
        // Effects
        /**
         * Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow
         */
        shadow: [{
          shadow: ["", "inner", "none", isTshirtSize, isArbitraryShadow]
        }],
        /**
         * Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow-color
         */
        "shadow-color": [{
          shadow: [isAny]
        }],
        /**
         * Opacity
         * @see https://tailwindcss.com/docs/opacity
         */
        opacity: [{
          opacity: [opacity]
        }],
        /**
         * Mix Blend Mode
         * @see https://tailwindcss.com/docs/mix-blend-mode
         */
        "mix-blend": [{
          "mix-blend": [...getBlendModes(), "plus-lighter", "plus-darker"]
        }],
        /**
         * Background Blend Mode
         * @see https://tailwindcss.com/docs/background-blend-mode
         */
        "bg-blend": [{
          "bg-blend": getBlendModes()
        }],
        // Filters
        /**
         * Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/filter
         */
        filter: [{
          filter: ["", "none"]
        }],
        /**
         * Blur
         * @see https://tailwindcss.com/docs/blur
         */
        blur: [{
          blur: [blur]
        }],
        /**
         * Brightness
         * @see https://tailwindcss.com/docs/brightness
         */
        brightness: [{
          brightness: [brightness]
        }],
        /**
         * Contrast
         * @see https://tailwindcss.com/docs/contrast
         */
        contrast: [{
          contrast: [contrast]
        }],
        /**
         * Drop Shadow
         * @see https://tailwindcss.com/docs/drop-shadow
         */
        "drop-shadow": [{
          "drop-shadow": ["", "none", isTshirtSize, isArbitraryValue]
        }],
        /**
         * Grayscale
         * @see https://tailwindcss.com/docs/grayscale
         */
        grayscale: [{
          grayscale: [grayscale]
        }],
        /**
         * Hue Rotate
         * @see https://tailwindcss.com/docs/hue-rotate
         */
        "hue-rotate": [{
          "hue-rotate": [hueRotate]
        }],
        /**
         * Invert
         * @see https://tailwindcss.com/docs/invert
         */
        invert: [{
          invert: [invert]
        }],
        /**
         * Saturate
         * @see https://tailwindcss.com/docs/saturate
         */
        saturate: [{
          saturate: [saturate]
        }],
        /**
         * Sepia
         * @see https://tailwindcss.com/docs/sepia
         */
        sepia: [{
          sepia: [sepia]
        }],
        /**
         * Backdrop Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/backdrop-filter
         */
        "backdrop-filter": [{
          "backdrop-filter": ["", "none"]
        }],
        /**
         * Backdrop Blur
         * @see https://tailwindcss.com/docs/backdrop-blur
         */
        "backdrop-blur": [{
          "backdrop-blur": [blur]
        }],
        /**
         * Backdrop Brightness
         * @see https://tailwindcss.com/docs/backdrop-brightness
         */
        "backdrop-brightness": [{
          "backdrop-brightness": [brightness]
        }],
        /**
         * Backdrop Contrast
         * @see https://tailwindcss.com/docs/backdrop-contrast
         */
        "backdrop-contrast": [{
          "backdrop-contrast": [contrast]
        }],
        /**
         * Backdrop Grayscale
         * @see https://tailwindcss.com/docs/backdrop-grayscale
         */
        "backdrop-grayscale": [{
          "backdrop-grayscale": [grayscale]
        }],
        /**
         * Backdrop Hue Rotate
         * @see https://tailwindcss.com/docs/backdrop-hue-rotate
         */
        "backdrop-hue-rotate": [{
          "backdrop-hue-rotate": [hueRotate]
        }],
        /**
         * Backdrop Invert
         * @see https://tailwindcss.com/docs/backdrop-invert
         */
        "backdrop-invert": [{
          "backdrop-invert": [invert]
        }],
        /**
         * Backdrop Opacity
         * @see https://tailwindcss.com/docs/backdrop-opacity
         */
        "backdrop-opacity": [{
          "backdrop-opacity": [opacity]
        }],
        /**
         * Backdrop Saturate
         * @see https://tailwindcss.com/docs/backdrop-saturate
         */
        "backdrop-saturate": [{
          "backdrop-saturate": [saturate]
        }],
        /**
         * Backdrop Sepia
         * @see https://tailwindcss.com/docs/backdrop-sepia
         */
        "backdrop-sepia": [{
          "backdrop-sepia": [sepia]
        }],
        // Tables
        /**
         * Border Collapse
         * @see https://tailwindcss.com/docs/border-collapse
         */
        "border-collapse": [{
          border: ["collapse", "separate"]
        }],
        /**
         * Border Spacing
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing": [{
          "border-spacing": [borderSpacing]
        }],
        /**
         * Border Spacing X
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-x": [{
          "border-spacing-x": [borderSpacing]
        }],
        /**
         * Border Spacing Y
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-y": [{
          "border-spacing-y": [borderSpacing]
        }],
        /**
         * Table Layout
         * @see https://tailwindcss.com/docs/table-layout
         */
        "table-layout": [{
          table: ["auto", "fixed"]
        }],
        /**
         * Caption Side
         * @see https://tailwindcss.com/docs/caption-side
         */
        caption: [{
          caption: ["top", "bottom"]
        }],
        // Transitions and Animation
        /**
         * Tranisition Property
         * @see https://tailwindcss.com/docs/transition-property
         */
        transition: [{
          transition: ["none", "all", "", "colors", "opacity", "shadow", "transform", isArbitraryValue]
        }],
        /**
         * Transition Duration
         * @see https://tailwindcss.com/docs/transition-duration
         */
        duration: [{
          duration: getNumberAndArbitrary()
        }],
        /**
         * Transition Timing Function
         * @see https://tailwindcss.com/docs/transition-timing-function
         */
        ease: [{
          ease: ["linear", "in", "out", "in-out", isArbitraryValue]
        }],
        /**
         * Transition Delay
         * @see https://tailwindcss.com/docs/transition-delay
         */
        delay: [{
          delay: getNumberAndArbitrary()
        }],
        /**
         * Animation
         * @see https://tailwindcss.com/docs/animation
         */
        animate: [{
          animate: ["none", "spin", "ping", "pulse", "bounce", isArbitraryValue]
        }],
        // Transforms
        /**
         * Transform
         * @see https://tailwindcss.com/docs/transform
         */
        transform: [{
          transform: ["", "gpu", "none"]
        }],
        /**
         * Scale
         * @see https://tailwindcss.com/docs/scale
         */
        scale: [{
          scale: [scale2]
        }],
        /**
         * Scale X
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-x": [{
          "scale-x": [scale2]
        }],
        /**
         * Scale Y
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-y": [{
          "scale-y": [scale2]
        }],
        /**
         * Rotate
         * @see https://tailwindcss.com/docs/rotate
         */
        rotate: [{
          rotate: [isInteger, isArbitraryValue]
        }],
        /**
         * Translate X
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-x": [{
          "translate-x": [translate]
        }],
        /**
         * Translate Y
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-y": [{
          "translate-y": [translate]
        }],
        /**
         * Skew X
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-x": [{
          "skew-x": [skew]
        }],
        /**
         * Skew Y
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-y": [{
          "skew-y": [skew]
        }],
        /**
         * Transform Origin
         * @see https://tailwindcss.com/docs/transform-origin
         */
        "transform-origin": [{
          origin: ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left", isArbitraryValue]
        }],
        // Interactivity
        /**
         * Accent Color
         * @see https://tailwindcss.com/docs/accent-color
         */
        accent: [{
          accent: ["auto", colors3]
        }],
        /**
         * Appearance
         * @see https://tailwindcss.com/docs/appearance
         */
        appearance: [{
          appearance: ["none", "auto"]
        }],
        /**
         * Cursor
         * @see https://tailwindcss.com/docs/cursor
         */
        cursor: [{
          cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", isArbitraryValue]
        }],
        /**
         * Caret Color
         * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
         */
        "caret-color": [{
          caret: [colors3]
        }],
        /**
         * Pointer Events
         * @see https://tailwindcss.com/docs/pointer-events
         */
        "pointer-events": [{
          "pointer-events": ["none", "auto"]
        }],
        /**
         * Resize
         * @see https://tailwindcss.com/docs/resize
         */
        resize: [{
          resize: ["none", "y", "x", ""]
        }],
        /**
         * Scroll Behavior
         * @see https://tailwindcss.com/docs/scroll-behavior
         */
        "scroll-behavior": [{
          scroll: ["auto", "smooth"]
        }],
        /**
         * Scroll Margin
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-m": [{
          "scroll-m": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin X
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mx": [{
          "scroll-mx": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Y
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-my": [{
          "scroll-my": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Start
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ms": [{
          "scroll-ms": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin End
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-me": [{
          "scroll-me": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Top
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mt": [{
          "scroll-mt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Right
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mr": [{
          "scroll-mr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Bottom
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mb": [{
          "scroll-mb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Left
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ml": [{
          "scroll-ml": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-p": [{
          "scroll-p": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding X
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-px": [{
          "scroll-px": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Y
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-py": [{
          "scroll-py": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Start
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-ps": [{
          "scroll-ps": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding End
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pe": [{
          "scroll-pe": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Top
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pt": [{
          "scroll-pt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Right
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pr": [{
          "scroll-pr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Bottom
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pb": [{
          "scroll-pb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Left
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pl": [{
          "scroll-pl": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Snap Align
         * @see https://tailwindcss.com/docs/scroll-snap-align
         */
        "snap-align": [{
          snap: ["start", "end", "center", "align-none"]
        }],
        /**
         * Scroll Snap Stop
         * @see https://tailwindcss.com/docs/scroll-snap-stop
         */
        "snap-stop": [{
          snap: ["normal", "always"]
        }],
        /**
         * Scroll Snap Type
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-type": [{
          snap: ["none", "x", "y", "both"]
        }],
        /**
         * Scroll Snap Type Strictness
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-strictness": [{
          snap: ["mandatory", "proximity"]
        }],
        /**
         * Touch Action
         * @see https://tailwindcss.com/docs/touch-action
         */
        touch: [{
          touch: ["auto", "none", "manipulation"]
        }],
        /**
         * Touch Action X
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-x": [{
          "touch-pan": ["x", "left", "right"]
        }],
        /**
         * Touch Action Y
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-y": [{
          "touch-pan": ["y", "up", "down"]
        }],
        /**
         * Touch Action Pinch Zoom
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-pz": ["touch-pinch-zoom"],
        /**
         * User Select
         * @see https://tailwindcss.com/docs/user-select
         */
        select: [{
          select: ["none", "text", "all", "auto"]
        }],
        /**
         * Will Change
         * @see https://tailwindcss.com/docs/will-change
         */
        "will-change": [{
          "will-change": ["auto", "scroll", "contents", "transform", isArbitraryValue]
        }],
        // SVG
        /**
         * Fill
         * @see https://tailwindcss.com/docs/fill
         */
        fill: [{
          fill: [colors3, "none"]
        }],
        /**
         * Stroke Width
         * @see https://tailwindcss.com/docs/stroke-width
         */
        "stroke-w": [{
          stroke: [isLength, isArbitraryLength, isArbitraryNumber]
        }],
        /**
         * Stroke
         * @see https://tailwindcss.com/docs/stroke
         */
        stroke: [{
          stroke: [colors3, "none"]
        }],
        // Accessibility
        /**
         * Screen Readers
         * @see https://tailwindcss.com/docs/screen-readers
         */
        sr: ["sr-only", "not-sr-only"],
        /**
         * Forced Color Adjust
         * @see https://tailwindcss.com/docs/forced-color-adjust
         */
        "forced-color-adjust": [{
          "forced-color-adjust": ["auto", "none"]
        }]
      },
      conflictingClassGroups: {
        overflow: ["overflow-x", "overflow-y"],
        overscroll: ["overscroll-x", "overscroll-y"],
        inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
        "inset-x": ["right", "left"],
        "inset-y": ["top", "bottom"],
        flex: ["basis", "grow", "shrink"],
        gap: ["gap-x", "gap-y"],
        p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
        px: ["pr", "pl"],
        py: ["pt", "pb"],
        m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
        mx: ["mr", "ml"],
        my: ["mt", "mb"],
        size: ["w", "h"],
        "font-size": ["leading"],
        "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
        "fvn-ordinal": ["fvn-normal"],
        "fvn-slashed-zero": ["fvn-normal"],
        "fvn-figure": ["fvn-normal"],
        "fvn-spacing": ["fvn-normal"],
        "fvn-fraction": ["fvn-normal"],
        "line-clamp": ["display", "overflow"],
        rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
        "rounded-s": ["rounded-ss", "rounded-es"],
        "rounded-e": ["rounded-se", "rounded-ee"],
        "rounded-t": ["rounded-tl", "rounded-tr"],
        "rounded-r": ["rounded-tr", "rounded-br"],
        "rounded-b": ["rounded-br", "rounded-bl"],
        "rounded-l": ["rounded-tl", "rounded-bl"],
        "border-spacing": ["border-spacing-x", "border-spacing-y"],
        "border-w": ["border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
        "border-w-x": ["border-w-r", "border-w-l"],
        "border-w-y": ["border-w-t", "border-w-b"],
        "border-color": ["border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
        "border-color-x": ["border-color-r", "border-color-l"],
        "border-color-y": ["border-color-t", "border-color-b"],
        "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
        "scroll-mx": ["scroll-mr", "scroll-ml"],
        "scroll-my": ["scroll-mt", "scroll-mb"],
        "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
        "scroll-px": ["scroll-pr", "scroll-pl"],
        "scroll-py": ["scroll-pt", "scroll-pb"],
        touch: ["touch-x", "touch-y", "touch-pz"],
        "touch-x": ["touch"],
        "touch-y": ["touch"],
        "touch-pz": ["touch"]
      },
      conflictingClassGroupModifiers: {
        "font-size": ["leading"]
      }
    };
  };
  var twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);

  // ../../ui/dist/index.js
  function cn(...inputs) {
    return twMerge(clsx(inputs));
  }
  function prefersReducedMotion2() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  var variantStyles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-brand-sm hover:shadow-brand-md",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    destructive: "bg-red-600 text-white hover:bg-red-700"
  };
  var sizeStyles = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-base",
    lg: "h-12 px-6 text-lg"
  };
  var Spinner = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      className: "animate-spin -ml-1 mr-2 h-4 w-4",
      fill: "none",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx(
          "circle",
          {
            className: "opacity-25",
            cx: "12",
            cy: "12",
            r: "10",
            stroke: "currentColor",
            strokeWidth: "4"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            className: "opacity-75",
            fill: "currentColor",
            d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          }
        )
      ]
    }
  );
  var Button = forwardRef(
    ({
      variant = "primary",
      size = "md",
      loading = false,
      className,
      children,
      disabled,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion2();
      return /* @__PURE__ */ jsxs(
        motion.button,
        {
          ref,
          whileHover: reducedMotion ? void 0 : { scale: 1.02 },
          whileTap: reducedMotion ? void 0 : { scale: 0.98 },
          transition: { duration: 0.15 },
          className: cn(
            // Base styles
            "inline-flex items-center justify-center font-medium rounded-full",
            "transition-all duration-fast",
            // Focus styles
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            // Disabled styles
            "disabled:opacity-50 disabled:pointer-events-none",
            // Variant styles
            variantStyles[variant],
            // Size styles
            sizeStyles[size],
            className
          ),
          disabled: disabled || loading,
          "aria-busy": loading,
          ...props,
          children: [
            loading && /* @__PURE__ */ jsx(Spinner, {}),
            children
          ]
        }
      );
    }
  );
  Button.displayName = "Button";
  var aspectRatioStyles = {
    square: "aspect-square",
    portrait: "aspect-[4/5]",
    landscape: "aspect-video"
  };
  var badgeStyles = {
    NEW: "bg-blue-50 text-blue-600",
    SALE: "bg-red-50 text-red-600",
    HOT: "bg-orange-50 text-orange-600"
  };
  var ProductCard = forwardRef(
    ({
      image,
      title,
      description,
      price,
      originalPrice,
      badge,
      aspectRatio: aspectRatio2 = "portrait",
      currency = "\xA5",
      onAddToCart,
      className,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion2();
      return /* @__PURE__ */ jsxs(
        motion.div,
        {
          ref,
          initial: reducedMotion ? void 0 : { opacity: 0, y: 20 },
          whileInView: reducedMotion ? void 0 : { opacity: 1, y: 0 },
          viewport: { once: true },
          whileHover: reducedMotion ? void 0 : { y: -8 },
          transition: { duration: 0.3, ease: [0, 0, 0.2, 1] },
          className: cn("group cursor-pointer", className),
          ...props,
          children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: cn(
                  "bg-slate-50 rounded-2xl mb-4 overflow-hidden relative",
                  "shadow-sm transition-all duration-normal",
                  "group-hover:shadow-card-hover",
                  "border border-transparent group-hover:border-blue-100",
                  aspectRatioStyles[aspectRatio2]
                ),
                children: [
                  image ? /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: image,
                      alt: title,
                      className: "w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
                    }
                  ) : /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-tr from-slate-100 to-white" }),
                  badge && /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: cn(
                        "absolute top-3 right-3",
                        "bg-white/90 backdrop-blur px-2.5 py-1 rounded-full",
                        "text-xs font-bold shadow-sm",
                        badgeStyles[badge]
                      ),
                      children: badge
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal" })
                ]
              }
            ),
            /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2", children: title }),
            description && /* @__PURE__ */ jsx("p", { className: "text-slate-500 text-sm mb-2 line-clamp-2", children: description }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxs("span", { className: "text-lg font-bold text-slate-900", children: [
                  currency,
                  price.toLocaleString()
                ] }),
                originalPrice && /* @__PURE__ */ jsxs("span", { className: "text-sm text-slate-400 line-through", children: [
                  currency,
                  originalPrice.toLocaleString()
                ] })
              ] }),
              onAddToCart && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onAddToCart();
                  },
                  className: cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "bg-blue-50 text-blue-600",
                    "hover:bg-blue-600 hover:text-white",
                    "transition-all duration-fast shadow-sm hover:shadow-brand-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  ),
                  "aria-label": `Add ${title} to cart`,
                  children: /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) })
                }
              )
            ] })
          ]
        }
      );
    }
  );
  ProductCard.displayName = "ProductCard";
  var Input = forwardRef(
    ({
      label,
      error,
      hint,
      prefixIcon,
      suffixIcon,
      className,
      id: id3,
      disabled,
      ...props
    }, ref) => {
      const generatedId = useId();
      const inputId = id3 || generatedId;
      const errorId = `${inputId}-error`;
      const hintId = `${inputId}-hint`;
      const hasError = !!error;
      return /* @__PURE__ */ jsxs("div", { className: "w-full", children: [
        label && /* @__PURE__ */ jsx(
          "label",
          {
            htmlFor: inputId,
            className: "block text-sm font-medium text-slate-700 mb-1.5",
            children: label
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          prefixIcon && /* @__PURE__ */ jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: prefixIcon }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref,
              id: inputId,
              className: cn(
                // Base styles
                "w-full h-10 px-4 rounded-lg border bg-white",
                "text-slate-900 placeholder:text-slate-400",
                "transition-all duration-fast",
                // Focus styles
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                // Error styles
                hasError ? "border-red-500 focus:ring-red-500" : "border-slate-200 hover:border-slate-300",
                // Disabled styles
                disabled && "bg-slate-50 text-slate-500 cursor-not-allowed",
                // Icon padding
                prefixIcon && "pl-10",
                suffixIcon && "pr-10",
                className
              ),
              disabled,
              "aria-invalid": hasError ? "true" : void 0,
              "aria-describedby": hasError ? errorId : hint ? hintId : void 0,
              ...props
            }
          ),
          suffixIcon && /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: suffixIcon })
        ] }),
        hasError && /* @__PURE__ */ jsxs(
          "p",
          {
            id: errorId,
            className: "mt-1.5 text-sm text-red-600 flex items-center gap-1",
            role: "alert",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx(
                "path",
                {
                  fillRule: "evenodd",
                  d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
                  clipRule: "evenodd"
                }
              ) }),
              error
            ]
          }
        ),
        hint && !hasError && /* @__PURE__ */ jsx("p", { id: hintId, className: "mt-1.5 text-sm text-slate-500", children: hint })
      ] });
    }
  );
  Input.displayName = "Input";
  function Navigation({ logo, items, actions, className }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const reducedMotion = prefersReducedMotion2();
    useEffect(() => {
      const handleScroll = () => setScrolled(window.scrollY > 0);
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth >= 768) {
          setMobileMenuOpen(false);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    return /* @__PURE__ */ jsxs(
      "nav",
      {
        className: cn(
          "sticky top-0 z-50 h-16 bg-white/90 backdrop-blur-md transition-all duration-normal",
          scrolled && "border-b border-slate-100 shadow-sm",
          className
        ),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("div", { className: "flex-shrink-0", children: logo }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex gap-8 text-sm font-medium", children: items.map((item) => /* @__PURE__ */ jsx(
              "a",
              {
                href: item.href,
                className: cn(
                  "transition-colors duration-fast",
                  item.active ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-blue-600"
                ),
                "aria-current": item.active ? "page" : void 0,
                children: item.label
              },
              item.href
            )) }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex items-center gap-4", children: actions }),
            /* @__PURE__ */ jsx(
              "button",
              {
                className: cn(
                  "md:hidden p-2 -mr-2 rounded-lg",
                  "text-slate-600 hover:bg-slate-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                ),
                onClick: () => setMobileMenuOpen(!mobileMenuOpen),
                "aria-label": mobileMenuOpen ? "Close menu" : "Open menu",
                "aria-expanded": mobileMenuOpen,
                "aria-controls": "mobile-menu",
                children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: mobileMenuOpen ? /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M6 18L18 6M6 6l12 12" }) : /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M4 6h16M4 12h16M4 18h16" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(AnimatePresence, { children: mobileMenuOpen && /* @__PURE__ */ jsx(
            motion.div,
            {
              id: "mobile-menu",
              initial: reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 },
              animate: reducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" },
              exit: reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 },
              transition: { duration: 0.2 },
              className: "md:hidden bg-white border-t border-slate-100 overflow-hidden",
              children: /* @__PURE__ */ jsxs("div", { className: "py-4 px-4 sm:px-6 space-y-1", children: [
                items.map((item) => /* @__PURE__ */ jsx(
                  "a",
                  {
                    href: item.href,
                    className: cn(
                      "block py-2.5 px-3 rounded-lg text-base transition-colors",
                      item.active ? "text-blue-600 font-semibold bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                    ),
                    onClick: () => setMobileMenuOpen(false),
                    children: item.label
                  },
                  item.href
                )),
                actions && /* @__PURE__ */ jsx("div", { className: "mt-4 pt-4 border-t border-slate-100", children: actions })
              ] })
            }
          ) })
        ]
      }
    );
  }
  Navigation.displayName = "Navigation";
  var gapStyles = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8"
  };
  function ProductGrid({
    children,
    columns = { sm: 2, md: 3, lg: 4 },
    gap = "md",
    className
  }) {
    const columnClasses = cn(
      "grid-cols-1",
      columns.sm && `sm:grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`
    );
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: cn(
          "grid",
          columnClasses,
          gapStyles[gap],
          className
        ),
        children
      }
    );
  }
  ProductGrid.displayName = "ProductGrid";

  // ../default/src/components/NotFound.tsx
  function NotFound({ route, message, onGoHome }) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4", children: /* @__PURE__ */ jsxs("div", { className: "text-center max-w-md w-full", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-8", children: /* @__PURE__ */ jsx("h1", { className: "text-7xl sm:text-9xl font-bold text-gray-200 dark:text-slate-700", children: "404" }) }),
      /* @__PURE__ */ jsx("h2", { className: "text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4", children: "Page Not Found" }),
      /* @__PURE__ */ jsx("p", { className: "text-gray-500 dark:text-gray-400 mb-8 text-sm sm:text-base", children: message || `Sorry, we couldn't find the page${route ? ` "${route}"` : ""} you're looking for.` }),
      /* @__PURE__ */ jsxs(Button, { onClick: onGoHome, size: "lg", className: "w-full sm:w-auto", children: [
        /* @__PURE__ */ jsx(House, { className: "h-5 w-5 mr-2" }),
        "Back to Home"
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-8 text-sm text-gray-400 dark:text-gray-500", children: "If you believe this is an error, please contact our support team." })
    ] }) });
  }

  // ../default/src/components/OrderCancelledPage.tsx
  function OrderCancelledPage({
    config,
    onReturnToCart,
    onContinueShopping,
    onContactSupport
  }) {
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-gray-50 dark:bg-slate-900", children: /* @__PURE__ */ jsx("div", { className: "container mx-auto px-4 py-12 sm:py-16", children: /* @__PURE__ */ jsxs("div", { className: "max-w-3xl mx-auto text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-8", children: /* @__PURE__ */ jsx("div", { className: "w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 flex items-center justify-center mx-auto shadow-sm", children: /* @__PURE__ */ jsx(CircleX, { className: "h-12 w-12 sm:h-14 sm:w-14 text-yellow-600 dark:text-yellow-400" }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "mb-8 sm:mb-12", children: [
        /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-full mb-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-2 h-2 bg-yellow-600 dark:bg-yellow-400 rounded-full" }),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest", children: "PAYMENT CANCELLED" })
        ] }),
        /* @__PURE__ */ jsx("h1", { className: "text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight", children: "Payment Cancelled" }),
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider", children: "NO CHARGES WERE MADE TO YOUR ACCOUNT" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8", children: /* @__PURE__ */ jsxs("div", { className: "space-y-4 text-left", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800", children: [
          /* @__PURE__ */ jsx("div", { className: "w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx(ShoppingCart, { className: "h-5 w-5 text-blue-600 dark:text-blue-400" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1", children: "CART SAVED" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-600 dark:text-gray-400", children: "All items remain in your cart and you can complete your purchase anytime" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800", children: [
          /* @__PURE__ */ jsx("div", { className: "w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsx(CircleHelp, { className: "h-5 w-5 text-purple-600 dark:text-purple-400" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1", children: "NEED HELP?" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-600 dark:text-gray-400", children: "If you encountered any issues during checkout, please contact our support team" })
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-6 justify-center", children: [
          /* @__PURE__ */ jsx("div", { className: "h-4 w-1 bg-blue-600 rounded-full" }),
          /* @__PURE__ */ jsx("h2", { className: "text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest", children: "WHAT HAPPENED" })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400 text-left mb-4", children: "You cancelled the payment process before completing your order. This could happen if you:" }),
        /* @__PURE__ */ jsxs("ul", { className: "text-left text-sm text-gray-600 dark:text-gray-400 space-y-2", children: [
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Clicked the back button during checkout" })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Closed the payment window" })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Decided to review your order again" })
          ] }),
          /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-blue-600 dark:text-blue-400 mt-1", children: "\u2022" }),
            /* @__PURE__ */ jsx("span", { children: "Encountered a technical issue" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-4 justify-center mb-6 sm:mb-8", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onReturnToCart,
            className: "h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2",
            children: [
              /* @__PURE__ */ jsx(ShoppingCart, { className: "h-4 w-4" }),
              "RETURN TO CART"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onContinueShopping,
            className: "h-12 px-8 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "CONTINUE SHOPPING"
            ]
          }
        )
      ] }),
      onContactSupport && /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: /* @__PURE__ */ jsxs("p", { children: [
        "NEED ASSISTANCE?",
        " ",
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onContactSupport,
            className: "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-wider",
            children: "CONTACT SUPPORT"
          }
        )
      ] }) })
    ] }) }) });
  }

  // src/site.ts
  function zhModeOf(locale) {
    if (locale === "zh-Hant") return "zh-Hant";
    if (locale === "zh-Hans") return "zh-Hans";
    return null;
  }
  function pickCopy(locale, copy) {
    if (locale === "ja") return copy.ja ?? copy.en;
    if (locale === "ko") return copy.ko ?? copy.en;
    if (locale === "fr") return copy.fr ?? copy.en;
    if (locale === "de") return copy.de ?? copy.en;
    const mode = zhModeOf(locale);
    if (mode === "zh-Hant") return copy.hant ?? copy.en;
    if (mode === "zh-Hans") return copy.hans ?? copy.hant ?? copy.en;
    return copy.en;
  }
  function pickLocalized(configured, englishDefault, zhHans, zhHant, mode) {
    const value = configured?.trim();
    if (value && value !== englishDefault) return value;
    if (mode === "zh-Hant") return zhHant;
    if (mode === "zh-Hans") return zhHans;
    return englishDefault;
  }
  function resolveBokmooSiteConfig(config, locale) {
    const brandName = config?.brand?.name?.trim() || "BOKMOO";
    const siteConfig = config?.site || {};
    const mode = zhModeOf(locale);
    const englishSubheadline = `Use multiple eSIM profiles on your ${brandName} card. Stay connected in 200+ countries.`;
    return {
      brandName,
      eyebrow: pickLocalized(siteConfig.eyebrow, "BOKMOO eSIM Card", "BOKMOO eSIM \u5361", "BOKMOO eSIM \u5361", mode),
      headline: pickLocalized(siteConfig.headline, "One Card.\nGlobal Connection.", "\u4E00\u5F20\u5361\u3002\n\u5168\u7403\u8FDE\u63A5\u3002", "\u4E00\u5F35\u5361\u3002\n\u5168\u7403\u9023\u7DDA\u3002", mode),
      subheadline: pickLocalized(
        siteConfig.subheadline,
        englishSubheadline,
        `\u5728\u60A8\u7684 ${brandName} \u5361\u4E0A\u4F7F\u7528\u591A\u4E2A eSIM \u914D\u7F6E\u6587\u4EF6\uFF0C200+ \u4E2A\u56FD\u5BB6/\u5730\u533A\u4FDD\u6301\u8FDE\u63A5\u3002`,
        `\u5728\u60A8\u7684 ${brandName} \u5361\u4E0A\u4F7F\u7528\u591A\u500B eSIM \u8A2D\u5B9A\u6A94\uFF0C200+ \u500B\u570B\u5BB6/\u5730\u5340\u4FDD\u6301\u9023\u7DDA\u3002`,
        mode
      ),
      supportEmail: siteConfig.supportEmail?.trim() || "support@bokmoo.com",
      primaryCtaLabel: pickLocalized(siteConfig.primaryCtaLabel, "Shop eSIM Plans", "\u9009\u8D2D eSIM \u65B9\u6848", "\u9078\u8CFC eSIM \u65B9\u6848", mode),
      primaryCtaHref: siteConfig.primaryCtaHref?.trim() || "/products",
      secondaryCtaLabel: pickLocalized(siteConfig.secondaryCtaLabel, "How it works", "\u4E86\u89E3\u4F7F\u7528\u65B9\u5F0F", "\u77AD\u89E3\u4F7F\u7528\u65B9\u5F0F", mode),
      secondaryCtaHref: siteConfig.secondaryCtaHref?.trim() || "/#how-it-works",
      apiBaseUrl: siteConfig.apiBaseUrl?.trim() || "https://api.bokmoo.com"
    };
  }
  function isExternalHref(href) {
    if (!href) return false;
    return /^(https?:)?\/\//.test(href);
  }

  // src/components/ProfilePage.tsx
  var SCRIPT_FONT = '"Snell Roundhand", "Savoye LET", "Segoe Script", "Brush Script MT", cursive';
  function svgBackgroundUri(svg) {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  var CLUBS_SCENE = svgBackgroundUri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='380' viewBox='0 0 640 380'><defs><linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0f1824'/><stop offset='0.42' stop-color='#1e2d3d'/><stop offset='0.68' stop-color='#5a4530'/><stop offset='1' stop-color='#0a0805'/></linearGradient><radialGradient id='glow' cx='0.64' cy='0.62' r='0.55'><stop offset='0' stop-color='#f2b552' stop-opacity='0.5'/><stop offset='1' stop-color='#f2b552' stop-opacity='0'/></radialGradient></defs><rect width='640' height='380' fill='url(#sky)'/><rect width='640' height='380' fill='url(#glow)'/><g fill='#f4c169'><circle cx='446' cy='232' r='2.4'/><circle cx='468' cy='240' r='1.6'/><circle cx='428' cy='243' r='1.4'/><circle cx='488' cy='230' r='1.2'/></g><g stroke='#060503' stroke-linecap='round' fill='none'><path d='M84 380C90 312 86 268 96 218' stroke-width='9'/><path d='M96 218C64 200 34 202 12 218M96 218C112 188 142 176 176 180M96 218C84 184 60 166 28 162M96 218C126 204 158 208 184 226M96 218C100 186 116 162 144 152' stroke-width='7'/><path d='M560 380C556 336 560 306 552 270' stroke-width='8'/><path d='M552 270C526 256 500 258 482 270M552 270C566 244 590 234 618 238M552 270C542 242 522 226 494 224M552 270C578 258 606 262 626 278M552 270C556 242 570 222 594 214' stroke-width='6'/></g><g fill='#f0b45c'><rect x='376' y='252' width='128' height='3' rx='1.5' opacity='0.4'/><rect x='296' y='274' width='208' height='3' rx='1.5' opacity='0.26'/><rect x='336' y='296' width='168' height='3' rx='1.5' opacity='0.18'/><rect x='260' y='318' width='230' height='3' rx='1.5' opacity='0.12'/></g></svg>`
  );
  var PROMO_SCENE = svgBackgroundUri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='320' viewBox='0 0 420 320'><defs><linearGradient id='dusk' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#181231'/><stop offset='0.44' stop-color='#2c2044'/><stop offset='0.7' stop-color='#4b2d3d'/><stop offset='1' stop-color='#0d0a12'/></linearGradient><radialGradient id='duskglow' cx='0.72' cy='0.58' r='0.5'><stop offset='0' stop-color='#e8a45c' stop-opacity='0.34'/><stop offset='1' stop-color='#e8a45c' stop-opacity='0'/></radialGradient></defs><rect width='420' height='320' fill='url(#dusk)'/><rect width='420' height='320' fill='url(#duskglow)'/><g fill='#ffffff' opacity='0.55'><circle cx='60' cy='52' r='1.1'/><circle cx='150' cy='34' r='0.9'/><circle cx='236' cy='60' r='1.2'/><circle cx='318' cy='40' r='1'/><circle cx='374' cy='84' r='0.9'/><circle cx='104' cy='96' r='0.8'/><circle cx='286' cy='104' r='0.8'/></g><g stroke='#070509' stroke-linecap='round' fill='none'><path d='M64 320C70 264 66 228 76 184' stroke-width='9'/><path d='M76 184C46 168 20 170 2 184M76 184C90 156 118 146 148 150M76 184C66 154 44 138 16 136M76 184C104 170 132 174 156 190M76 184C80 156 94 134 120 126' stroke-width='7'/></g><g fill='#e8a45c'><rect x='150' y='212' width='150' height='2.6' rx='1.3' opacity='0.3'/><rect x='196' y='236' width='170' height='2.6' rx='1.3' opacity='0.2'/><rect x='120' y='262' width='210' height='2.6' rx='1.3' opacity='0.13'/></g></svg>`
  );
  var GOLD_GRADIENT_BG = "bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))]";
  function formatDate(iso, locale) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "\u2014";
    return date.toLocaleDateString(locale === "zh-Hant" ? "zh-TW" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }
  function timezoneLabel() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const offsetMinutes = -(/* @__PURE__ */ new Date()).getTimezoneOffset();
      const sign = offsetMinutes < 0 ? "-" : "+";
      const abs = Math.abs(offsetMinutes);
      const hours = Math.floor(abs / 60);
      const minutes = abs % 60;
      return `(UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}) ${zone}`;
    } catch {
      return "UTC";
    }
  }
  var ProfilePage = react_default.memo(function ProfilePage2({
    user,
    isLoading,
    isAuthenticated,
    config,
    locale,
    onNavigate,
    onNavigateToSettings,
    onNavigateToOrders,
    onNavigateToLogin,
    addresses,
    isLoadingAddresses,
    onAddAddress,
    onDeleteAddress,
    onSetDefaultAddress
  }) {
    const isZhHant = locale === "zh-Hant";
    const [showAddressForm, setShowAddressForm] = react_default.useState(false);
    const site = resolveBokmooSiteConfig(config);
    const go = react_default.useCallback(
      (path) => {
        if (onNavigate) {
          onNavigate(path);
          return;
        }
        const prefix = locale === "zh-Hant" ? "/zh-Hant" : locale === "zh-Hans" ? "/zh-Hans" : "/en";
        window.location.assign(`${prefix}${path}`);
      },
      [onNavigate, isZhHant]
    );
    const [copied, setCopied] = react_default.useState(false);
    const copyEmail = react_default.useCallback(async () => {
      if (!user?.email) return;
      try {
        await navigator.clipboard.writeText(user.email);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2e3);
      } catch {
      }
    }, [user?.email]);
    if (!isAuthenticated || !user) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4", children: /* @__PURE__ */ jsx("div", { className: "w-full max-w-md", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(UserRound, { className: "h-8 w-8" }) }),
        /* @__PURE__ */ jsx("h2", { className: "mt-6 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Sign in to view your profile", hans: "\u767B\u5165\u4EE5\u67E5\u770B\u60A8\u7684\u4E2A\u4EBA\u6863\u6848", hant: "\u767B\u5165\u4EE5\u67E5\u770B\u60A8\u7684\u500B\u4EBA\u6A94\u6848" }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Please log in to check your BOKMOO account", hans: "\u8BF7\u767B\u5165\u4EE5\u67E5\u770B\u60A8\u7684 BOKMOO \u5E10\u6237", hant: "\u8ACB\u767B\u5165\u4EE5\u67E5\u770B\u60A8\u7684 BOKMOO \u5E33\u6236" }) }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onNavigateToLogin,
            className: `mt-8 h-12 w-full rounded-full px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)] ${GOLD_GRADIENT_BG}`,
            type: "button",
            children: pickCopy(locale, { en: "Log In", hans: "\u767B\u5165", hant: "\u767B\u5165" })
          }
        )
      ] }) }) });
    }
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)]", children: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--bokmoo-line)] border-t-[var(--bokmoo-gold)]" }),
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Loading profile...", hans: "\u6B63\u5728\u8F7D\u5165\u4E2A\u4EBA\u8D44\u6599\u2026", hant: "\u6B63\u5728\u8F09\u5165\u500B\u4EBA\u8CC7\u6599\u2026" }) })
      ] }) });
    }
    const displayName = (user.name || "").trim();
    const firstName = displayName ? displayName.split(/\s+/)[0] : "";
    const greeting = firstName ? locale === "zh-Hant" ? `\u4F60\u597D\uFF0C${firstName}\uFF01` : locale === "zh-Hans" ? `\u4F60\u597D\uFF0C${firstName}\uFF01` : `Hi ${firstName}!` : locale === "zh-Hant" ? "\u4F60\u597D\uFF01" : locale === "zh-Hans" ? "\u4F60\u597D\uFF01" : "Hi there!";
    const accountInitial = (displayName || user.email).trim().charAt(0).toUpperCase();
    const memberSince = user.createdAt ? formatDate(user.createdAt, locale) : "\u2014";
    const navItems = [
      {
        label: pickCopy(locale, { en: "My Account", hans: "\u6211\u7684\u5E10\u6237", hant: "\u6211\u7684\u5E33\u6236" }),
        icon: UserRound,
        active: true,
        onClick: () => window.scrollTo({ top: 0, behavior: "smooth" })
      },
      { label: pickCopy(locale, { en: "Order History", hans: "\u8BA2\u5355\u7EAA\u5F55", hant: "\u8A02\u55AE\u7D00\u9304" }), icon: ShoppingBag, onClick: onNavigateToOrders },
      { label: pickCopy(locale, { en: "My Trips", hans: "\u6211\u7684\u884C\u7A0B", hant: "\u6211\u7684\u884C\u7A0B" }), icon: Plane, onClick: onNavigateToOrders },
      { label: pickCopy(locale, { en: "Travel Credits", hans: "\u65C5\u6E38\u70B9\u6570", hant: "\u65C5\u904A\u9EDE\u6578" }), icon: Mail, onClick: () => go("/affiliate") },
      { label: pickCopy(locale, { en: "Affiliate Program", hans: "\u63A8\u5E7F\u8BA1\u5212", hant: "\u63A8\u5EE3\u8A08\u5283" }), icon: Users, onClick: () => go("/affiliate") },
      { label: pickCopy(locale, { en: "Settings", hans: "\u8BBE\u5B9A", hant: "\u8A2D\u5B9A" }), icon: Settings, onClick: onNavigateToSettings }
    ];
    const renderNavButton = (item, layout2) => {
      const Icon2 = item.icon;
      const base = layout2 === "sidebar" ? "flex w-full shrink-0 items-center gap-3 rounded-[0.9rem] px-4 py-3 text-[0.92rem] font-medium transition-colors" : "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[0.85rem] font-medium transition-colors";
      const tone = item.active ? layout2 === "sidebar" ? "bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_13%,transparent)] text-[var(--bokmoo-ink)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)]" : "border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_13%,transparent)] text-[var(--bokmoo-ink)]" : "border-transparent text-[var(--bokmoo-copy-soft)] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent)] hover:text-[var(--bokmoo-ink)]";
      return /* @__PURE__ */ jsxs("button", { onClick: item.onClick, className: `${base} ${tone}`, type: "button", children: [
        /* @__PURE__ */ jsx(
          Icon2,
          {
            className: `h-[1.05rem] w-[1.05rem] ${item.active ? "text-[var(--bokmoo-gold)]" : "text-[color:color-mix(in_oklab,var(--bokmoo-copy-soft)_80%,var(--bokmoo-gold))]"}`
          }
        ),
        item.label
      ] }, item.label);
    };
    const infoRowIcon = "h-4 w-4 shrink-0 text-[var(--bokmoo-copy-soft)]";
    const editButtonClass = "inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-soft)_60%,transparent)] px-4 text-[0.8rem] font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]";
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] lg:flex", children: [
      /* @__PURE__ */ jsxs("aside", { className: "hidden w-64 shrink-0 flex-col border-r border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_94%,black)] px-4 pb-10 pt-6 lg:flex", children: [
        /* @__PURE__ */ jsx("nav", { className: "flex flex-col gap-1.5", children: navItems.map((item) => renderNavButton(item, "sidebar")) }),
        /* @__PURE__ */ jsx("div", { className: "mt-auto pt-10", children: /* @__PURE__ */ jsxs(
          "div",
          {
            onClick: () => go("/products"),
            className: "group relative min-h-[13.5rem] cursor-pointer overflow-hidden rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] shadow-[var(--bokmoo-shadow)]",
            style: { backgroundImage: PROMO_SCENE, backgroundSize: "cover", backgroundPosition: "center" },
            children: [
              /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(9,7,14,0.1),rgba(9,7,14,0.78))]" }),
              /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-[13.5rem] flex-col p-5", children: [
                /* @__PURE__ */ jsx("h3", { className: "max-w-[9.5rem] text-xl font-bold leading-snug text-white", children: pickCopy(locale, { en: "Explore a Better Night", hans: "\u63A2\u7D22\u66F4\u7F8E\u597D\u7684\u591C\u665A", hant: "\u63A2\u7D22\u66F4\u7F8E\u597D\u7684\u591C\u665A" }) }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-relaxed text-white/70", children: pickCopy(locale, { en: "Premium club experiences around the world.", hans: "\u5168\u7403\u9AD8\u7EA7\u4F1A\u6240\u4F53\u9A8C\uFF0C\u5C3D\u5728\u638C\u63E1\u3002", hant: "\u5168\u7403\u9AD8\u7D1A\u6703\u6240\u9AD4\u9A57\uFF0C\u76E1\u5728\u638C\u63E1\u3002" }) }),
                /* @__PURE__ */ jsxs("span", { className: "mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_86%,white),color-mix(in_oklab,var(--bokmoo-gold)_70%,black))] px-4 py-2 text-xs font-bold text-[var(--bokmoo-bg)] transition-transform duration-300 group-hover:-translate-y-0.5", children: [
                  pickCopy(locale, { en: "Browse Destinations", hans: "\u6D4F\u89C8\u76EE\u7684\u5730", hant: "\u700F\u89BD\u76EE\u7684\u5730" }),
                  /* @__PURE__ */ jsx(ArrowRight, { className: "h-3.5 w-3.5" })
                ] })
              ] })
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8", children: [
        /* @__PURE__ */ jsx("div", { className: "-mx-4 mb-5 overflow-x-auto px-4 pb-1 lg:hidden", children: /* @__PURE__ */ jsx("div", { className: "flex w-max gap-2", children: navItems.map((item) => renderNavButton(item, "chip")) }) }),
        /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1200px] space-y-6", children: [
          /* @__PURE__ */ jsxs("section", { className: "relative overflow-hidden rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[linear-gradient(115deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,black),color-mix(in_oklab,var(--bokmoo-bg-soft)_70%,var(--bokmoo-bg-elevated)))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                "aria-hidden": "true",
                className: "pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] sm:block",
                style: {
                  backgroundImage: "radial-gradient(color-mix(in oklab, var(--bokmoo-gold) 26%, transparent) 1.2px, transparent 1.4px)",
                  backgroundSize: "13px 13px",
                  maskImage: "radial-gradient(ellipse 85% 90% at 76% 48%, black 0%, transparent 74%)",
                  WebkitMaskImage: "radial-gradient(ellipse 85% 90% at 76% 48%, black 0%, transparent 74%)"
                }
              }
            ),
            /* @__PURE__ */ jsxs(
              "svg",
              {
                "aria-hidden": "true",
                className: "pointer-events-none absolute -right-8 -top-10 hidden h-[150%] w-[44%] opacity-35 sm:block",
                viewBox: "0 0 400 280",
                fill: "none",
                children: [
                  /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: "bokmoo-hero-arc", x1: "0", y1: "280", x2: "400", y2: "40", gradientUnits: "userSpaceOnUse", children: [
                    /* @__PURE__ */ jsx("stop", { stopColor: "var(--bokmoo-gold)", stopOpacity: "0" }),
                    /* @__PURE__ */ jsx("stop", { offset: "0.55", stopColor: "var(--bokmoo-gold)", stopOpacity: "0.8" }),
                    /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#f6d78a", stopOpacity: "0.2" })
                  ] }) }),
                  /* @__PURE__ */ jsx("path", { d: "M12 262C86 138 252 66 400 84", stroke: "url(#bokmoo-hero-arc)", strokeWidth: "1.5" }),
                  /* @__PURE__ */ jsx("path", { d: "M52 280C124 168 276 100 400 116", stroke: "url(#bokmoo-hero-arc)", strokeWidth: "1", opacity: "0.65" })
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "relative flex flex-col gap-6 sm:flex-row sm:items-center", children: [
              /* @__PURE__ */ jsxs("div", { className: "relative shrink-0 self-center sm:self-start", children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: `flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-4xl font-bold text-[var(--bokmoo-bg)] shadow-[0_18px_44px_color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] ${GOLD_GRADIENT_BG}`,
                    children: user.avatar ? /* @__PURE__ */ jsx("img", { src: user.avatar, alt: user.name, className: "h-full w-full object-cover" }) : accountInitial
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[0.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_34%,transparent)] bg-[color:oklch(0.09_0.01_75_/_0.96)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-gold)]", children: pickCopy(locale, { en: "Member", hans: "\u4F1A\u5458", hant: "\u6703\u54E1" }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0 text-center sm:text-left", children: [
                /* @__PURE__ */ jsx("h1", { className: "text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-[var(--bokmoo-ink)]", children: greeting }),
                /* @__PURE__ */ jsxs("div", { className: "mt-2.5 flex items-center justify-center gap-2 sm:justify-start", children: [
                  /* @__PURE__ */ jsx("p", { className: "truncate text-[0.95rem] text-[var(--bokmoo-copy)]", children: user.email }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: copyEmail,
                      className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.5rem] text-[var(--bokmoo-copy-soft)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] hover:text-[var(--bokmoo-gold)]",
                      type: "button",
                      "aria-label": pickCopy(locale, { en: "Copy email", hans: "\u590D\u5236\u7535\u5B50\u90AE\u4EF6", hant: "\u8907\u88FD\u96FB\u5B50\u90F5\u4EF6" }),
                      children: copied ? /* @__PURE__ */ jsx(Check, { className: "h-4 w-4 text-[var(--bokmoo-success)]" }) : /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4" })
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("p", { className: "mt-1.5 text-[0.82rem] text-[var(--bokmoo-copy-soft)]", children: [
                  pickCopy(locale, { en: "Member since", hans: "\u6CE8\u518C\u4E8E", hant: "\u8A3B\u518A\u65BC" }),
                  " ",
                  memberSince
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { "aria-hidden": "true", className: "relative ml-auto hidden select-none flex-col items-end pr-2 lg:flex", children: [
                /* @__PURE__ */ jsxs(
                  "span",
                  {
                    className: "bg-[linear-gradient(120deg,#f6d78a,var(--bokmoo-gold-strong)_55%,#c99b3e)] bg-clip-text text-right text-[1.65rem] italic leading-[1.2] text-transparent",
                    style: { fontFamily: SCRIPT_FONT },
                    children: [
                      "Better Nights",
                      /* @__PURE__ */ jsx("br", {}),
                      "Brighter Journeys"
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(Plane, { className: "mt-1 h-5 w-5 -rotate-6 text-[color:color-mix(in_oklab,var(--bokmoo-gold)_78%,white)]" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "grid gap-6 lg:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
                  /* @__PURE__ */ jsx(UserRound, { className: "h-[1.1rem] w-[1.1rem] text-[var(--bokmoo-gold)]" }),
                  /* @__PURE__ */ jsx("h3", { className: "text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Account Information", hans: "\u5E10\u6237\u8D44\u6599", hant: "\u5E33\u6236\u8CC7\u6599" }) })
                ] }),
                /* @__PURE__ */ jsxs("button", { onClick: onNavigateToSettings, className: editButtonClass, type: "button", children: [
                  /* @__PURE__ */ jsx(PencilLine, { className: "h-3.5 w-3.5" }),
                  pickCopy(locale, { en: "Edit", hans: "\u7F16\u8F91", hant: "\u7DE8\u8F2F" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-3 divide-y divide-[color:color-mix(in_oklab,var(--bokmoo-line)_55%,transparent)]", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-3.5", children: [
                  /* @__PURE__ */ jsx(Mail, { className: infoRowIcon }),
                  /* @__PURE__ */ jsx("span", { className: "w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32", children: pickCopy(locale, { en: "Email Address", hans: "\u7535\u5B50\u90AE\u4EF6", hant: "\u96FB\u5B50\u90F5\u4EF6" }) }),
                  /* @__PURE__ */ jsx(
                    "span",
                    {
                      className: "min-w-0 flex-1 truncate text-right text-sm font-semibold text-[var(--bokmoo-ink)] sm:text-left",
                      title: user.email,
                      children: user.email
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-3.5", children: [
                  /* @__PURE__ */ jsx(CalendarDays, { className: infoRowIcon }),
                  /* @__PURE__ */ jsx("span", { className: "w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32", children: pickCopy(locale, { en: "Member Since", hans: "\u6CE8\u518C\u65E5\u671F", hant: "\u8A3B\u518A\u65E5\u671F" }) }),
                  /* @__PURE__ */ jsx("span", { className: "flex-1 text-sm font-semibold text-[var(--bokmoo-ink)]", children: memberSince })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-3.5", children: [
                  /* @__PURE__ */ jsx(UserRound, { className: infoRowIcon }),
                  /* @__PURE__ */ jsx("span", { className: "w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32", children: pickCopy(locale, { en: "Account Status", hans: "\u5E10\u6237\u72B6\u6001", hant: "\u5E33\u6236\u72C0\u614B" }) }),
                  /* @__PURE__ */ jsx("span", { className: "inline-flex items-center rounded-[0.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-success)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-success)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--bokmoo-success)]", children: pickCopy(locale, { en: "Active Member", hans: "\u6709\u6548\u4F1A\u5458", hant: "\u6709\u6548\u6703\u54E1" }) })
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
                  /* @__PURE__ */ jsx(Settings, { className: "h-[1.1rem] w-[1.1rem] text-[var(--bokmoo-gold)]" }),
                  /* @__PURE__ */ jsx("h3", { className: "text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Account Preferences", hans: "\u504F\u597D\u8BBE\u5B9A", hant: "\u504F\u597D\u8A2D\u5B9A" }) })
                ] }),
                /* @__PURE__ */ jsxs("button", { onClick: onNavigateToSettings, className: editButtonClass, type: "button", children: [
                  /* @__PURE__ */ jsx(PencilLine, { className: "h-3.5 w-3.5" }),
                  pickCopy(locale, { en: "Edit", hans: "\u7F16\u8F91", hant: "\u7DE8\u8F2F" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-3 divide-y divide-[color:color-mix(in_oklab,var(--bokmoo-line)_55%,transparent)]", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-3.5", children: [
                  /* @__PURE__ */ jsx(Earth, { className: infoRowIcon }),
                  /* @__PURE__ */ jsx("span", { className: "w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32", children: pickCopy(locale, { en: "Language", hans: "\u8BED\u8A00", hant: "\u8A9E\u8A00" }) }),
                  /* @__PURE__ */ jsx("span", { className: "flex-1 text-sm font-semibold text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "English", hans: "\u7E41\u4F53\u4E2D\u6587", hant: "\u7E41\u9AD4\u4E2D\u6587" }) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-3.5", children: [
                  /* @__PURE__ */ jsx(Clock3, { className: infoRowIcon }),
                  /* @__PURE__ */ jsx("span", { className: "w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32", children: pickCopy(locale, { en: "Timezone", hans: "\u65F6\u533A", hant: "\u6642\u5340" }) }),
                  /* @__PURE__ */ jsx("span", { className: "flex-1 text-sm font-semibold text-[var(--bokmoo-ink)]", children: timezoneLabel() })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-3.5", children: [
                  /* @__PURE__ */ jsx(CalendarDays, { className: infoRowIcon }),
                  /* @__PURE__ */ jsx("span", { className: "w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32", children: pickCopy(locale, { en: "Date of Birth", hans: "\u51FA\u751F\u65E5\u671F", hant: "\u51FA\u751F\u65E5\u671F" }) }),
                  /* @__PURE__ */ jsx("span", { className: "flex-1 text-sm text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Not set", hans: "\u672A\u8BBE\u5B9A", hant: "\u672A\u8A2D\u5B9A" }) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-3.5", children: [
                  /* @__PURE__ */ jsx(Phone, { className: infoRowIcon }),
                  /* @__PURE__ */ jsx("span", { className: "w-28 shrink-0 text-sm text-[var(--bokmoo-copy-soft)] sm:w-32", children: pickCopy(locale, { en: "Phone Number", hans: "\u7535\u8BDD\u53F7\u7801", hant: "\u96FB\u8A71\u865F\u78BC" }) }),
                  /* @__PURE__ */ jsx("span", { className: "flex-1 text-sm text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Not set", hans: "\u672A\u8BBE\u5B9A", hant: "\u672A\u8A2D\u5B9A" }) })
                ] })
              ] })
            ] })
          ] }),
          onAddAddress ? /* @__PURE__ */ jsxs("section", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)] sm:p-6", children: [
            /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between gap-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_15%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(MapPin, { className: "h-6 w-6" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold tracking-tight text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "My Addresses", hans: "\u6211\u7684\u5730\u5740", hant: "\u6211\u7684\u5730\u5740" }) }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Saved shipping addresses for checkout", hans: "\u7ED3\u7B97\u65F6\u4F7F\u7528\u7684\u6536\u8D27\u5730\u5740", hant: "\u7D50\u5E33\u6642\u4F7F\u7528\u7684\u6536\u8CA8\u5730\u5740" }) })
              ] })
            ] }) }),
            isLoadingAddresses ? /* @__PURE__ */ jsx("p", { className: "mt-5 text-sm text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Loading\u2026", hans: "\u52A0\u8F7D\u4E2D\u2026", hant: "\u8F09\u5165\u4E2D\u2026" }) }) : /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-3", children: [
              (addresses ?? []).length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "No saved addresses yet.", hans: "\u8FD8\u6CA1\u6709\u4FDD\u5B58\u7684\u5730\u5740\u3002", hant: "\u9084\u6C92\u6709\u4FDD\u5B58\u7684\u5730\u5740\u3002" }) }) : (addresses ?? []).map((address) => /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "flex flex-col gap-3 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4 sm:flex-row sm:items-center sm:justify-between",
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "text-sm", children: [
                      /* @__PURE__ */ jsxs("p", { className: "flex flex-wrap items-center gap-2 font-medium text-[var(--bokmoo-ink)]", children: [
                        address.name,
                        address.isDefault ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--bokmoo-gold)]", children: pickCopy(locale, { en: "Default", hans: "\u9ED8\u8BA4", hant: "\u9810\u8A2D" }) }) : null
                      ] }),
                      /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[var(--bokmoo-copy)]", children: [
                        address.phone,
                        " \xB7 ",
                        address.line1,
                        address.city ? `, ${address.city}` : "",
                        address.state ? `, ${address.state}` : "",
                        address.country ? ` \xB7 ${address.country}` : ""
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [
                      !address.isDefault && onSetDefaultAddress ? /* @__PURE__ */ jsx(
                        "button",
                        {
                          onClick: () => void onSetDefaultAddress(address.id),
                          className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1.5 text-xs text-[var(--bokmoo-copy)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)]",
                          type: "button",
                          children: pickCopy(locale, { en: "Set default", hans: "\u8BBE\u4E3A\u9ED8\u8BA4", hant: "\u8A2D\u70BA\u9810\u8A2D" })
                        }
                      ) : null,
                      onDeleteAddress ? /* @__PURE__ */ jsx(
                        "button",
                        {
                          onClick: () => void onDeleteAddress(address.id),
                          className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1.5 text-xs text-[var(--bokmoo-copy)] transition-colors hover:border-[var(--bokmoo-danger)] hover:text-[var(--bokmoo-danger)]",
                          type: "button",
                          children: pickCopy(locale, { en: "Delete", hans: "\u5220\u9664", hant: "\u522A\u9664" })
                        }
                      ) : null
                    ] })
                  ]
                },
                address.id
              )),
              showAddressForm ? /* @__PURE__ */ jsxs(
                "form",
                {
                  className: "grid gap-3 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4 sm:grid-cols-2",
                  onSubmit: (event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const input = {
                      name: String(data.get("name") || "").trim(),
                      phone: String(data.get("phone") || "").trim(),
                      line1: String(data.get("line1") || "").trim(),
                      city: String(data.get("city") || "").trim(),
                      state: String(data.get("state") || "").trim(),
                      postalCode: String(data.get("postalCode") || "").trim(),
                      country: String(data.get("country") || "").trim()
                    };
                    if (!input.name || !input.phone || !input.line1 || !input.city || !input.country) return;
                    void onAddAddress(input).then(() => setShowAddressForm(false));
                  },
                  children: [
                    /* @__PURE__ */ jsx("input", { name: "name", required: true, placeholder: pickCopy(locale, { en: "Full name", hans: "\u59D3\u540D", hant: "\u59D3\u540D" }), className: "rounded-[0.7rem] border border-[var(--bokmoo-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("input", { name: "phone", required: true, placeholder: pickCopy(locale, { en: "Phone", hans: "\u624B\u673A\u53F7", hant: "\u624B\u6A5F\u865F" }), className: "rounded-[0.7rem] border border-[var(--bokmoo-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("input", { name: "line1", required: true, placeholder: pickCopy(locale, { en: "Address", hans: "\u8BE6\u7EC6\u5730\u5740", hant: "\u8A73\u7D30\u5730\u5740" }), className: "sm:col-span-2 rounded-[0.7rem] border border-[var(--bokmoo-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("input", { name: "city", required: true, placeholder: pickCopy(locale, { en: "City", hans: "\u57CE\u5E02", hant: "\u57CE\u5E02" }), className: "rounded-[0.7rem] border border-[var(--bokmoo-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("input", { name: "state", placeholder: pickCopy(locale, { en: "State / Province", hans: "\u7701/\u5DDE", hant: "\u7701/\u5DDE" }), className: "rounded-[0.7rem] border border-[var(--bokmoo-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("input", { name: "postalCode", placeholder: pickCopy(locale, { en: "Postal code", hans: "\u90AE\u7F16", hant: "\u90F5\u905E\u5340\u865F" }), className: "rounded-[0.7rem] border border-[var(--bokmoo-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsx("input", { name: "country", required: true, placeholder: pickCopy(locale, { en: "Country (e.g. CN)", hans: "\u56FD\u5BB6\uFF08\u5982 CN\uFF09", hant: "\u570B\u5BB6\uFF08\u5982 CN\uFF09" }), className: "rounded-[0.7rem] border border-[var(--bokmoo-line)] bg-transparent px-3 py-2.5 text-sm text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]" }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-2 sm:col-span-2", children: [
                      /* @__PURE__ */ jsx("button", { onClick: () => setShowAddressForm(false), className: "rounded-full px-4 py-2 text-xs text-[var(--bokmoo-copy)]", type: "button", children: pickCopy(locale, { en: "Cancel", hans: "\u53D6\u6D88", hant: "\u53D6\u6D88" }) }),
                      /* @__PURE__ */ jsx("button", { className: "rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 py-2 text-xs font-semibold text-[var(--bokmoo-bg)]", type: "submit", children: pickCopy(locale, { en: "Save address", hans: "\u4FDD\u5B58\u5730\u5740", hant: "\u4FDD\u5B58\u5730\u5740" }) })
                    ] })
                  ]
                }
              ) : /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => setShowAddressForm(true),
                  className: "inline-flex min-h-10 items-center gap-2 rounded-full border border-dashed border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] px-4 text-xs font-medium text-[var(--bokmoo-gold)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)]",
                  type: "button",
                  children: [
                    "+ ",
                    pickCopy(locale, { en: "Add a new address", hans: "\u6DFB\u52A0\u65B0\u5730\u5740", hant: "\u6DFB\u52A0\u65B0\u5730\u5740" })
                  ]
                }
              )
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxs("section", { className: "grid gap-6 lg:grid-cols-2", children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                onClick: onNavigateToOrders,
                className: "group flex cursor-pointer items-center justify-between gap-4 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] sm:p-6",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                    /* @__PURE__ */ jsx("div", { className: "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_15%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(ShoppingBag, { className: "h-6 w-6" }) }),
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold tracking-tight text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Order History", hans: "\u8BA2\u5355\u7EAA\u5F55", hant: "\u8A02\u55AE\u7D00\u9304" }) }),
                      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "View and manage your orders", hans: "\u67E5\u770B\u53CA\u7BA1\u7406\u60A8\u7684\u8BA2\u5355", hant: "\u67E5\u770B\u53CA\u7BA1\u7406\u60A8\u7684\u8A02\u55AE" }) })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--bokmoo-line-strong)] text-[var(--bokmoo-copy)] transition-colors group-hover:border-[var(--bokmoo-gold)] group-hover:text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-[1.1rem] w-[1.1rem]" }) })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "div",
              {
                onClick: onNavigateToOrders,
                className: "group flex cursor-pointer items-center justify-between gap-4 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_38%,transparent)] sm:p-6",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                    /* @__PURE__ */ jsx("div", { className: "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_15%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Plane, { className: "h-6 w-6" }) }),
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold tracking-tight text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Upcoming Trips", hans: "\u5373\u5C06\u5230\u6765\u7684\u884C\u7A0B", hant: "\u5373\u5C07\u5230\u4F86\u7684\u884C\u7A0B" }) }),
                      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Your booked experiences", hans: "\u60A8\u5DF2\u9884\u8BA2\u7684\u4F53\u9A8C", hant: "\u60A8\u5DF2\u9810\u8A02\u7684\u9AD4\u9A57" }) })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--bokmoo-line-strong)] text-[var(--bokmoo-copy)] transition-colors group-hover:border-[var(--bokmoo-gold)] group-hover:text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-[1.1rem] w-[1.1rem]" }) })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("section", { className: "grid gap-6 lg:grid-cols-3", children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                onClick: () => go(site.primaryCtaHref || "/products"),
                className: "group relative min-h-[15rem] cursor-pointer overflow-hidden rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] shadow-[var(--bokmoo-shadow)]",
                style: { backgroundImage: CLUBS_SCENE, backgroundSize: "cover", backgroundPosition: "center" },
                children: [
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(92deg,rgba(8,6,4,0.86)_8%,rgba(8,6,4,0.42)_58%,rgba(8,6,4,0.12))]" }),
                  /* @__PURE__ */ jsxs("div", { className: "relative flex h-full flex-col p-6", children: [
                    /* @__PURE__ */ jsx("h3", { className: "text-[1.55rem] font-bold leading-tight text-white", children: locale === "zh-Hant" ? "\u63A2\u7D22\u5C0A\u8CB4\u6703\u6240" : locale === "zh-Hans" ? "\u63A2\u7D22\u5C0A\u8D35\u4F1A\u6240" : /* @__PURE__ */ jsxs(Fragment2, { children: [
                      "Discover",
                      /* @__PURE__ */ jsx("br", {}),
                      "Exclusive Clubs"
                    ] }) }),
                    /* @__PURE__ */ jsx("p", { className: "mt-2.5 max-w-[15rem] text-sm leading-relaxed text-white/75", children: pickCopy(locale, { en: "Access the world's best venues with BOKMOO.", hans: "\u4E0E BOKMOO \u901A\u884C\u5168\u7403\u9876\u7EA7\u573A\u6240\u3002", hant: "\u8207 BOKMOO \u901A\u884C\u5168\u7403\u9802\u7D1A\u5834\u6240\u3002" }) }),
                    /* @__PURE__ */ jsxs("span", { className: "mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_86%,white),color-mix(in_oklab,var(--bokmoo-gold)_70%,black))] px-5 py-2.5 text-[0.8rem] font-bold text-[var(--bokmoo-bg)] transition-transform duration-300 group-hover:-translate-y-0.5", children: [
                      pickCopy(locale, { en: "Explore Now", hans: "\u7ACB\u5373\u63A2\u7D22", hant: "\u7ACB\u5373\u63A2\u7D22" }),
                      /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                    ] })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
                /* @__PURE__ */ jsx(Crown, { className: "h-5 w-5 text-[var(--bokmoo-gold)]" }),
                /* @__PURE__ */ jsx("h3", { className: "text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "BOKMOO Member Benefits", hans: "BOKMOO \u4F1A\u5458\u6743\u76CA", hant: "BOKMOO \u6703\u54E1\u6B0A\u76CA" }) })
              ] }),
              /* @__PURE__ */ jsx("ul", { className: "mt-5 space-y-3.5", children: (locale === "zh-Hant" ? ["\u5168\u7403\u9802\u7D1A\u6703\u6240\u901A\u884C", "\u6703\u54E1\u5C08\u5C6C\u512A\u60E0", "\u8F15\u9B06\u9810\u8A02\uFF0C\u5373\u6642\u78BA\u8A8D", "\u5C08\u5C6C\u652F\u63F4"] : locale === "zh-Hans" ? ["\u5168\u7403\u9876\u7EA7\u4F1A\u6240\u901A\u884C", "\u4F1A\u5458\u4E13\u5C5E\u4F18\u60E0", "\u8F7B\u677E\u9884\u8BA2\uFF0C\u5373\u65F6\u786E\u8BA4", "\u4E13\u5C5E\u652F\u63F4"] : [
                "Access to premier clubs worldwide",
                "Exclusive member-only offers",
                "Easy booking and instant confirmation",
                "Dedicated support"
              ]).map((benefit) => /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-3", children: [
                /* @__PURE__ */ jsx(Check, { className: "mt-0.5 h-4 w-4 shrink-0 text-[var(--bokmoo-gold)]" }),
                /* @__PURE__ */ jsx("span", { className: "text-sm leading-relaxed text-[var(--bokmoo-copy)]", children: benefit })
              ] }, benefit)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
                /* @__PURE__ */ jsx(Headphones, { className: "h-5 w-5 text-[var(--bokmoo-gold)]" }),
                /* @__PURE__ */ jsx("h3", { className: "text-[1.05rem] font-bold tracking-tight text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Need Help?", hans: "\u9700\u8981\u534F\u52A9\uFF1F", hant: "\u9700\u8981\u5354\u52A9\uFF1F" }) })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-2.5 text-sm leading-relaxed text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Our support team is here for you.", hans: "\u6211\u4EEC\u7684\u652F\u63F4\u56E2\u961F\u968F\u65F6\u4E3A\u60A8\u670D\u52A1\u3002", hant: "\u6211\u5011\u7684\u652F\u63F4\u5718\u968A\u96A8\u6642\u70BA\u60A8\u670D\u52D9\u3002" }) }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => go("/contact"),
                  className: "mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_46%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-sm font-semibold text-[var(--bokmoo-gold)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)]",
                  type: "button",
                  children: [
                    pickCopy(locale, { en: "Contact Support", hans: "\u8054\u7EDC\u5BA2\u670D", hant: "\u806F\u7D61\u5BA2\u670D" }),
                    /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => go("/help"),
                  className: "mt-5 inline-flex items-center justify-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] transition-colors hover:text-[var(--bokmoo-ink)]",
                  type: "button",
                  children: [
                    /* @__PURE__ */ jsx(BookOpen, { className: "h-4 w-4" }),
                    pickCopy(locale, { en: "Visit Help Center", hans: "\u524D\u5F80\u5E2E\u52A9\u4E2D\u5FC3", hant: "\u524D\u5F80\u5E6B\u52A9\u4E2D\u5FC3" })
                  ]
                }
              )
            ] })
          ] })
        ] })
      ] })
    ] });
  });

  // src/components/AuthCallbackPage.tsx
  var FOCUS_VISIBLE_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function AuthCallbackPage({
    isLoading,
    error,
    config,
    onRetry,
    onNavigateToHome
  }) {
    const site = resolveBokmooSiteConfig(config);
    return /* @__PURE__ */ jsxs("div", { className: "relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_26%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_84%,black))]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "relative w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-6 text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: error ? /* @__PURE__ */ jsx(TriangleAlert, { className: "h-7 w-7" }) : isLoading ? /* @__PURE__ */ jsx(LoaderCircle, { className: "h-7 w-7 animate-spin" }) : /* @__PURE__ */ jsx(ShieldCheck, { className: "h-7 w-7" }) }),
        /* @__PURE__ */ jsxs("p", { className: "mt-6 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]", children: [
          site.brandName.toUpperCase(),
          " account"
        ] }),
        /* @__PURE__ */ jsx("h1", { className: "mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: error ? "Authentication failed" : "Completing sign in" }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm leading-6 text-[var(--bokmoo-copy)]", children: error || "Securing your session and returning you to the BOKMOO storefront." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-7 grid gap-3 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onRetry,
              className: `inline-flex min-h-12 items-center justify-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING}`,
              children: "Back to sign in"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onNavigateToHome,
              className: `inline-flex min-h-12 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-4 text-sm font-black uppercase tracking-[0.16em] text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING}`,
              children: "Home"
            }
          )
        ] })
      ] }) })
    ] });
  }

  // src/lib/api.ts
  var BokmooApiError = class extends Error {
    constructor(status, code, message, requestId) {
      super(message);
      this.name = "BokmooApiError";
      this.status = status;
      this.code = code;
      this.requestId = requestId;
    }
  };
  function getProductIdFromLocation() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("productId") || params.get("id");
    if (queryId) return queryId;
    const segments = window.location.pathname.split("/").filter(Boolean);
    const productsIndex = segments.lastIndexOf("products");
    if (productsIndex >= 0 && segments[productsIndex + 1]) {
      return decodeURIComponent(segments[productsIndex + 1]);
    }
    return null;
  }
  function getOrderIdFromLocation() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("orderId") || params.get("id");
    if (queryId) return queryId;
    const segments = window.location.pathname.split("/").filter(Boolean);
    const ordersIndex = segments.lastIndexOf("orders");
    if (ordersIndex >= 0 && segments[ordersIndex + 1]) {
      return decodeURIComponent(segments[ordersIndex + 1]);
    }
    return null;
  }
  function getClientToken() {
    if (typeof window === "undefined") return null;
    try {
      const localStorageToken = window.localStorage.getItem("auth_token");
      if (localStorageToken) return localStorageToken;
    } catch {
    }
    const cookieValue = `; ${document.cookie}`;
    const parts = cookieValue.split("; auth_token=");
    if (parts.length === 2) {
      return parts.pop()?.split(";").shift() || null;
    }
    return null;
  }
  function normalizeResponse(payload) {
    if (payload && typeof payload === "object" && "data" in payload && payload.data !== void 0) {
      return payload.data;
    }
    return payload;
  }
  function asRecord(value) {
    return value && typeof value === "object" ? value : {};
  }
  function readString(source, keys) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return void 0;
  }
  function readNullableString(source, keys) {
    for (const key of keys) {
      const value = source[key];
      if (value === null) return null;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return void 0;
  }
  function normalizeInstructions(value) {
    if (!value) return {};
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return {};
      try {
        return normalizeInstructions(JSON.parse(trimmed));
      } catch {
        return { general: [trimmed] };
      }
    }
    if (Array.isArray(value)) {
      return { general: value.filter((item) => typeof item === "string" && item.trim().length > 0) };
    }
    const source = asRecord(value);
    return {
      ios: Array.isArray(source.ios) ? source.ios.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
      android: Array.isArray(source.android) ? source.android.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
      general: Array.isArray(source.general) ? source.general.filter((item) => typeof item === "string" && item.trim().length > 0) : []
    };
  }
  function normalizeSupport(value, source) {
    const support = asRecord(value);
    return {
      email: readString(support, ["email"]) || readString(source, ["supportEmail", "support_email"]),
      phone: readString(support, ["phone"]) || readString(source, ["supportPhone", "support_phone"])
    };
  }
  function storefrontSameOriginBase(baseUrl) {
    try {
      if (typeof location !== "undefined" && !baseUrl.startsWith("/")) {
        const target = new URL(baseUrl, location.origin);
        if (target.origin !== location.origin) {
          return "";
        }
      }
    } catch {
    }
    return baseUrl;
  }
  async function requestEnvelope(config, endpoint, method = "GET", body) {
    const headers = {
      Accept: "application/json"
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    const resolvedToken = config.token === void 0 ? getClientToken() : config.token;
    if (resolvedToken) {
      headers.Authorization = `Bearer ${resolvedToken}`;
    }
    const url = `${storefrontSameOriginBase(config.baseUrl.replace(/\/$/, ""))}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0,
      cache: "no-store"
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = json.error;
      throw new BokmooApiError(
        response.status,
        error?.code || "API_ERROR",
        error?.message || `Request failed with status ${response.status}`,
        error?.requestId
      );
    }
    if (json && typeof json === "object" && "data" in json && json.data !== void 0) {
      return json;
    }
    return { data: json };
  }
  async function request(config, endpoint, method = "GET", body) {
    const envelope = await requestEnvelope(config, endpoint, method, body);
    return normalizeResponse(envelope);
  }
  function buildEsimSummary(source) {
    const data = source?.data?.gb ? `${source.data.gb}GB` : "Flexible data";
    const validity = source?.validityDays ? `${source.validityDays} Days` : "Flexible validity";
    return `${data} / ${validity}`;
  }
  function buildTechnologyLabel(source) {
    const technology = source?.networks?.technology?.filter(Boolean) || [];
    return technology.length ? `${technology.join("/")} High Speed` : "4G/5G High Speed";
  }
  function mapVariant(variant) {
    const esim = variant.attributes?.esim;
    return {
      id: variant.id,
      name: displayProductTitle(variant.name),
      value: buildEsimSummary(esim),
      type: "STYLE",
      price: variant.salePrice,
      inventory: variant.isActive === false ? 0 : 99
    };
  }
  function displayProductTitle(name) {
    const cleaned = String(name || "").replace(/^\[[^\]]*\]\s*/, "").replace(/\s+V\d+$/i, "").trim();
    return cleaned || String(name || "");
  }
  function resolveBokmooMediaUrl(url, apiBaseUrl) {
    const value = String(url || "").trim();
    if (!value) return null;
    if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
    if (!apiBaseUrl) return value;
    return `${apiBaseUrl.replace(/\/+$/, "")}${value.startsWith("/") ? "" : "/"}${value}`;
  }
  function mapBokmooApiProductToThemeProduct(product) {
    const esim = product.typeData?.esim;
    const firstImage = product.images?.[0];
    const imageUrl = (typeof firstImage === "string" ? firstImage : firstImage?.url) || product.image;
    const regionTag = esim?.region || esim?.country || "Travel";
    const technology = buildTechnologyLabel(esim);
    const variantPrices = (product.variants || []).map((variant) => Number(variant.salePrice || 0)).filter((price) => price > 0);
    const sellablePrice = variantPrices.length > 0 ? Math.min(...variantPrices) : Number(product.price || 0);
    return {
      id: product.id,
      name: displayProductTitle(product.name),
      description: product.description || `${displayProductTitle(product.name)} travel connectivity package`,
      price: sellablePrice,
      sku: product.slug || product.id,
      productKind: product.productKind,
      category: {
        id: esim?.region || "esim",
        name: esim?.region || "eSIM Plans",
        slug: (esim?.region || "esim").toLowerCase().replace(/\s+/g, "-"),
        level: 1,
        isActive: true,
        productCount: 0
      },
      tags: [regionTag, esim?.carrier || "Carrier", technology].filter(Boolean),
      images: imageUrl ? [
        {
          id: `${product.id}-image`,
          url: imageUrl,
          alt: product.name,
          order: 0,
          isMain: true
        }
      ] : [],
      variants: (product.variants || []).map(mapVariant),
      inventory: {
        quantity: 99,
        reserved: 0,
        available: 99,
        lowStockThreshold: 5,
        isInStock: true,
        isLowStock: false,
        trackInventory: false
      },
      specifications: [
        { name: "Coverage", value: esim?.country || esim?.region || "Global" },
        { name: "Data", value: esim?.data?.gb ? `${esim.data.gb}GB` : "Flexible" },
        { name: "Validity", value: esim?.validityDays ? `${esim.validityDays} Days` : "Flexible" },
        { name: "Carrier", value: esim?.carrier || "Local carrier" },
        { name: "Network", value: technology }
      ],
      isActive: true,
      isFeatured: true,
      rating: 4.9,
      reviewCount: 1200,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function mapBokmooApiOrderToThemeOrder(order) {
    return {
      id: order.id,
      userId: "",
      status: order.status || order.fulfillmentStatus || order.paymentStatus || "PROCESSING",
      paymentStatus: order.paymentStatus || "PAID",
      totalAmount: Number(order.totalAmount || 0),
      currency: order.currency || "USD",
      shippingAddress: null,
      shipments: (order.shipments || []).map((shipment) => ({ ...shipment, trackingUrl: shipment.trackingUrl || null, shippedAt: shipment.shippedAt || null, deliveredAt: shipment.deliveredAt || null, estimatedDeliveryAt: shipment.estimatedDeliveryAt || null, lastCheckedAt: shipment.lastCheckedAt || null })),
      items: (order.items || []).map((item) => {
        const quantity = Number(item.quantity || 1);
        const unitPrice = Number(item.unitPrice ?? item.totalPrice ?? 0);
        const totalPrice = Number(item.totalPrice ?? unitPrice * quantity);
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId || "",
          quantity,
          unitPrice,
          totalPrice,
          fulfillmentStatus: item.fulfillmentStatus || null,
          fulfillmentData: item.fulfillmentData || null
        };
      }),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt || order.createdAt,
      cancelReason: null,
      cancelledAt: null
    };
  }
  function normalizeProductForTheme(product) {
    const candidate = product;
    if (candidate && typeof candidate === "object" && Array.isArray(candidate.images) && Array.isArray(candidate.variants) && candidate.category && candidate.inventory) {
      return candidate;
    }
    return mapBokmooApiProductToThemeProduct(product);
  }
  function normalizeInstallSession(session) {
    const source = asRecord(session);
    const matchingId = readString(source, ["matchingId", "matching_id", "activationCode", "activation_code"]);
    const activationCode = readString(source, ["activationCode", "activation_code", "matchingId", "matching_id"]);
    const smdpAddress = readString(source, ["smdpAddress", "smdp_address", "smdpServer", "smdp_server", "smdp"]);
    const lpaString = readString(source, ["lpaString", "lpa_string", "lpa", "qrCodeContent", "qr_code_content"]) || (smdpAddress && (matchingId || activationCode) ? `LPA:1$${smdpAddress}$${matchingId || activationCode}` : "");
    const qrCode = readString(source, ["qrCode", "qr_code", "qrCodeUrl", "qr_code_url", "qrCodeContent", "qr_code_content"]) || lpaString;
    const instructions = normalizeInstructions(source.instructions);
    return {
      ...session,
      orderId: readString(source, ["orderId", "order_id"]) || session.orderId || "",
      orderNumber: readString(source, ["orderNumber", "order_number"]) || session.orderNumber || "",
      status: readString(source, ["status"]) || session.status || "processing",
      packageTitle: readString(source, ["packageTitle", "package_title"]) || session.packageTitle || "BOKMOO eSIM",
      qrCode,
      activationCode: activationCode || "",
      matchingId: matchingId || "",
      lpaString,
      smdpAddress,
      confirmationCode: readNullableString(source, ["confirmationCode", "confirmation_code", "confirmCode", "confirm_code"]) ?? null,
      instructions: {
        ios: instructions.ios || [],
        android: instructions.android || [],
        general: instructions.general || []
      },
      support: normalizeSupport(source.support, source)
    };
  }
  async function getBokmooProducts(config, params = {}) {
    const search = new URLSearchParams();
    search.set("page", String(params.page || 1));
    search.set("limit", String(params.limit || 12));
    search.set("locale", params.locale || "en");
    search.set("type", params.type || "esim");
    if (params.country) search.set("country", params.country);
    const envelope = await requestEnvelope(config, `/api/products?${search.toString()}`);
    const meta = envelope.meta || {};
    const data = envelope.data;
    const items = Array.isArray(data) ? data : data.items || [];
    const page = Number(meta.page || (!Array.isArray(data) ? data.page : void 0) || params.page || 1);
    const limit = Number(meta.limit || (!Array.isArray(data) ? data.limit : void 0) || params.limit || 12);
    const total = Number(meta.total || (!Array.isArray(data) ? data.total : void 0) || items.length);
    return {
      ...Array.isArray(data) ? {} : data,
      items,
      page,
      limit,
      total
    };
  }
  async function getBokmooProduct(config, productId, locale = "en") {
    return request(config, `/api/products/${productId}?locale=${locale}`);
  }
  async function getBokmooOrder(config, orderId2) {
    return request(config, `/api/orders/${orderId2}`);
  }
  async function getBokmooOrders(config, params = {}) {
    const search = new URLSearchParams();
    search.set("page", String(params.page || 1));
    search.set("limit", String(params.limit || 10));
    if (params.status) search.set("status", params.status);
    const envelope = await requestEnvelope(config, `/api/orders?${search.toString()}`);
    const meta = envelope.meta || {};
    const data = envelope.data;
    const items = Array.isArray(data) ? data : data.items || [];
    const page = Number(meta.page || (!Array.isArray(data) ? data.page : void 0) || params.page || 1);
    const limit = Number(meta.limit || (!Array.isArray(data) ? data.limit : void 0) || params.limit || 10);
    const total = Number(meta.total || (!Array.isArray(data) ? data.total : void 0) || items.length);
    return {
      ...Array.isArray(data) ? {} : data,
      items,
      page,
      limit,
      total
    };
  }
  async function getBokmooInstallSession(config, orderId2) {
    const session = await request(config, `/api/orders/${orderId2}/install-session`);
    return normalizeInstallSession(session);
  }
  var affiliateBase = "/api/v1/plugins/affiliate/store";
  async function getBokmooAffiliatePartner(config) {
    return request(config, `${affiliateBase}/partners/me`);
  }
  async function registerBokmooAffiliatePartner(config, input) {
    return request(config, `${affiliateBase}/partners/register`, "POST", input);
  }
  async function getBokmooAffiliateCommissions(config) {
    const result = await request(config, `${affiliateBase}/commissions`);
    return result.items || [];
  }
  async function getBokmooAffiliateOrganization(config) {
    return request(config, `${affiliateBase}/organizations/me`);
  }
  async function createBokmooAffiliateOrganization(config, input) {
    return request(config, `${affiliateBase}/organizations`, "POST", input);
  }
  async function addBokmooAffiliateMember(config, organizationId, input) {
    return request(config, `${affiliateBase}/organizations/${encodeURIComponent(organizationId)}/members`, "POST", input);
  }
  async function getBokmooOrganizationCommissions(config) {
    const result = await request(config, `${affiliateBase}/organizations/commissions`);
    return result.items || [];
  }

  // src/components/AffiliatePage.tsx
  function money(items) {
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return `${items[0]?.currency || "USD"} ${total.toFixed(2)}`;
  }
  function orderId(item) {
    return item.orderId || item.order_id || "";
  }
  function createdAt(item) {
    return item.createdAt || item.created_at || "";
  }
  var AffiliatePage = react_default.memo(function AffiliatePage2({
    isLoading,
    isAuthenticated,
    config,
    locale,
    onNavigateBack,
    onNavigateToLogin
  }) {
    const site = resolveBokmooSiteConfig(config);
    const api = react_default.useMemo(() => ({ baseUrl: site.apiBaseUrl }), [site.apiBaseUrl]);
    const [view2, setView] = react_default.useState("partner");
    const [partner, setPartner] = react_default.useState(null);
    const [commissions, setCommissions] = react_default.useState([]);
    const [organization, setOrganization] = react_default.useState(null);
    const [organizationCommissions, setOrganizationCommissions] = react_default.useState([]);
    const [loading, setLoading] = react_default.useState(false);
    const [error, setError] = react_default.useState("");
    const [copied, setCopied] = react_default.useState(false);
    const [displayName, setDisplayName] = react_default.useState("");
    const [organizationCode, setOrganizationCode] = react_default.useState("");
    const [organizationName, setOrganizationName] = react_default.useState("");
    const [organizationRate, setOrganizationRate] = react_default.useState("2.5");
    const [memberEmail, setMemberEmail] = react_default.useState("");
    const [memberRole, setMemberRole] = react_default.useState("INFLUENCER");
    const refresh = react_default.useCallback(async () => {
      if (!isAuthenticated) return;
      setLoading(true);
      setError("");
      const [partnerResult, organizationResult] = await Promise.allSettled([
        Promise.all([getBokmooAffiliatePartner(api), getBokmooAffiliateCommissions(api)]),
        Promise.all([
          getBokmooAffiliateOrganization(api),
          getBokmooOrganizationCommissions(api).catch((cause) => {
            if (cause instanceof BokmooApiError && cause.status === 404) return [];
            throw cause;
          })
        ])
      ]);
      if (partnerResult.status === "fulfilled") {
        setPartner(partnerResult.value[0]);
        setCommissions(partnerResult.value[1]);
      } else if (!(partnerResult.reason instanceof BokmooApiError && partnerResult.reason.status === 404)) {
        setError(partnerResult.reason instanceof Error ? partnerResult.reason.message : "Affiliate data could not be loaded");
      }
      if (organizationResult.status === "fulfilled") {
        setOrganization(organizationResult.value[0]);
        setOrganizationCommissions(organizationResult.value[1]);
      } else if (!(organizationResult.reason instanceof BokmooApiError && organizationResult.reason.status === 404)) {
        setError(organizationResult.reason instanceof Error ? organizationResult.reason.message : "Organization data could not be loaded");
      }
      setLoading(false);
    }, [api, isAuthenticated]);
    react_default.useEffect(() => {
      void refresh();
    }, [refresh]);
    if (isLoading) return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    if (!isAuthenticated) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-5", children: /* @__PURE__ */ jsxs("div", { className: "max-w-md border-y border-[var(--bokmoo-line)] py-10 text-center", children: [
        /* @__PURE__ */ jsx(WalletCards, { className: "mx-auto h-7 w-7 text-[var(--bokmoo-gold)]" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 text-3xl text-[var(--bokmoo-ink)]", children: "Affiliate workspace" }),
        /* @__PURE__ */ jsx("button", { onClick: onNavigateToLogin, className: "mt-7 min-h-11 bg-[var(--bokmoo-gold)] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]", type: "button", children: "Sign in" })
      ] }) });
    }
    const shareUrl = partner && typeof window !== "undefined" ? `${window.location.origin}/${locale || "en"}/r/${encodeURIComponent(partner.code)}` : "";
    return /* @__PURE__ */ jsx("main", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-20 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-6xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4 border-b border-[var(--bokmoo-line)] pb-6", children: [
        /* @__PURE__ */ jsx("button", { onClick: onNavigateBack, className: "inline-flex h-10 w-10 items-center justify-center border border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]", "aria-label": "Back", type: "button", children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex border border-[var(--bokmoo-line)] p-1", role: "tablist", "aria-label": "Affiliate view", children: [
          /* @__PURE__ */ jsx("button", { onClick: () => setView("partner"), className: `min-h-9 px-4 text-xs font-semibold ${view2 === "partner" ? "bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "text-[var(--bokmoo-copy)]"}`, type: "button", children: "Partner" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setView("organization"), className: `min-h-9 px-4 text-xs font-semibold ${view2 === "organization" ? "bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "text-[var(--bokmoo-copy)]"}`, type: "button", children: "Organization" })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: () => void refresh(), className: "inline-flex h-10 w-10 items-center justify-center border border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]", "aria-label": "Refresh", type: "button", children: /* @__PURE__ */ jsx(RefreshCw, { className: `h-4 w-4 ${loading ? "animate-spin" : ""}` }) })
      ] }),
      error ? /* @__PURE__ */ jsx("div", { className: "mt-5 border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--bokmoo-ink)]", children: error }) : null,
      view2 === "partner" ? /* @__PURE__ */ jsx("section", { className: "pt-10", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-8 lg:grid-cols-[1.1fr_0.9fr]", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase text-[var(--bokmoo-copy-soft)]", children: "Personal affiliate" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-3 max-w-2xl text-4xl text-[var(--bokmoo-ink)] sm:text-5xl", children: "Your referral ledger." }),
          partner ? /* @__PURE__ */ jsxs("div", { className: "mt-10 border-y border-[var(--bokmoo-line)] py-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 sm:flex-row", children: [
              /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-3 text-sm text-[var(--bokmoo-copy)]", children: /* @__PURE__ */ jsx("span", { className: "block truncate", children: shareUrl }) }),
              /* @__PURE__ */ jsxs("button", { onClick: async () => {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }, className: "inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]", type: "button", children: [
                copied ? /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4" }),
                copied ? "Copied" : "Copy link"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm", children: [
              /* @__PURE__ */ jsxs("span", { children: [
                /* @__PURE__ */ jsx("b", { className: "text-2xl text-[var(--bokmoo-ink)]", children: money(commissions) }),
                /* @__PURE__ */ jsx("small", { className: "ml-2 text-[var(--bokmoo-copy-soft)]", children: "earned" })
              ] }),
              /* @__PURE__ */ jsxs("span", { children: [
                /* @__PURE__ */ jsxs("b", { className: "text-2xl text-[var(--bokmoo-ink)]", children: [
                  partner.commissionRate,
                  "%"
                ] }),
                /* @__PURE__ */ jsx("small", { className: "ml-2 text-[var(--bokmoo-copy-soft)]", children: "rate" })
              ] }),
              /* @__PURE__ */ jsxs("span", { children: [
                /* @__PURE__ */ jsx("b", { className: "text-2xl text-[var(--bokmoo-ink)]", children: commissions.length }),
                /* @__PURE__ */ jsx("small", { className: "ml-2 text-[var(--bokmoo-copy-soft)]", children: "orders" })
              ] })
            ] })
          ] }) : /* @__PURE__ */ jsxs("form", { onSubmit: async (event) => {
            event.preventDefault();
            setLoading(true);
            setError("");
            try {
              await registerBokmooAffiliatePartner(api, { displayName, organizationCode: organizationCode || void 0 });
              await refresh();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Registration failed");
            } finally {
              setLoading(false);
            }
          }, className: "mt-10 grid max-w-xl gap-4 border-y border-[var(--bokmoo-line)] py-7", children: [
            /* @__PURE__ */ jsx("input", { value: displayName, onChange: (event) => setDisplayName(event.target.value), placeholder: "Display name", required: true, className: "h-12 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" }),
            /* @__PURE__ */ jsx("input", { value: organizationCode, onChange: (event) => setOrganizationCode(event.target.value.toUpperCase()), placeholder: "Organization code (optional)", className: "h-12 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" }),
            /* @__PURE__ */ jsx("button", { disabled: loading, className: "min-h-12 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:opacity-50", type: "submit", children: "Create affiliate account" })
          ] })
        ] }),
        /* @__PURE__ */ jsx(CommissionList, { items: commissions, title: "Partner commissions" })
      ] }) }) : /* @__PURE__ */ jsx("section", { className: "pt-10", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-8 lg:grid-cols-[1.1fr_0.9fr]", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase text-[var(--bokmoo-copy-soft)]", children: "Organization affiliate" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-3 max-w-2xl text-4xl text-[var(--bokmoo-ink)] sm:text-5xl", children: "Creator network." }),
          organization ? /* @__PURE__ */ jsxs("div", { className: "mt-9", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end justify-between gap-5 border-y border-[var(--bokmoo-line)] py-6", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--bokmoo-copy-soft)]", children: organization.code }),
                /* @__PURE__ */ jsx("h2", { className: "mt-2 text-2xl text-[var(--bokmoo-ink)]", children: organization.name })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                /* @__PURE__ */ jsx("p", { className: "text-2xl font-semibold text-[var(--bokmoo-ink)]", children: money(organizationCommissions) }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-[var(--bokmoo-copy-soft)]", children: [
                  organization.commissionRate,
                  "% organization rate"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("form", { onSubmit: async (event) => {
              event.preventDefault();
              setLoading(true);
              setError("");
              try {
                await addBokmooAffiliateMember(api, organization.id, { email: memberEmail, role: memberRole });
                setMemberEmail("");
                await refresh();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Member could not be added");
              } finally {
                setLoading(false);
              }
            }, className: "mt-7 flex flex-col gap-3 sm:flex-row", children: [
              /* @__PURE__ */ jsx("input", { type: "email", value: memberEmail, onChange: (event) => setMemberEmail(event.target.value), placeholder: "Member email", required: true, className: "h-11 min-w-0 flex-1 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" }),
              /* @__PURE__ */ jsxs("select", { value: memberRole, onChange: (event) => setMemberRole(event.target.value), className: "h-11 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-3 text-sm text-[var(--bokmoo-ink)]", children: [
                /* @__PURE__ */ jsx("option", { value: "INFLUENCER", children: "Influencer" }),
                /* @__PURE__ */ jsx("option", { value: "MANAGER", children: "Manager" })
              ] }),
              /* @__PURE__ */ jsxs("button", { className: "inline-flex h-11 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]", type: "submit", children: [
                /* @__PURE__ */ jsx(UserPlus, { className: "h-4 w-4" }),
                "Add"
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-7 divide-y divide-[var(--bokmoo-line)] border-y border-[var(--bokmoo-line)]", children: organization.members.map((member) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 py-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-semibold text-[var(--bokmoo-ink)]", children: member.username || member.email }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 truncate text-xs text-[var(--bokmoo-copy-soft)]", children: member.email })
              ] }),
              /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-[var(--bokmoo-gold)]", children: member.role })
            ] }, member.id)) })
          ] }) : /* @__PURE__ */ jsxs("form", { onSubmit: async (event) => {
            event.preventDefault();
            setLoading(true);
            setError("");
            try {
              await createBokmooAffiliateOrganization(api, { name: organizationName, commissionRate: Number(organizationRate) });
              await refresh();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Organization could not be created");
            } finally {
              setLoading(false);
            }
          }, className: "mt-10 grid max-w-xl gap-4 border-y border-[var(--bokmoo-line)] py-7", children: [
            /* @__PURE__ */ jsx("input", { value: organizationName, onChange: (event) => setOrganizationName(event.target.value), placeholder: "Organization name", required: true, className: "h-12 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" }),
            /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("span", { className: "text-sm text-[var(--bokmoo-copy)]", children: "Commission rate" }),
              /* @__PURE__ */ jsx("input", { type: "number", min: "0", max: "90", step: "0.1", value: organizationRate, onChange: (event) => setOrganizationRate(event.target.value), className: "h-12 w-28 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("button", { disabled: loading, className: "inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:opacity-50", type: "submit", children: [
              /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
              "Create organization"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx(CommissionList, { items: organizationCommissions, title: "Organization commissions" })
      ] }) })
    ] }) });
  });
  function CommissionList({ items, title }) {
    return /* @__PURE__ */ jsxs("aside", { className: "border-l border-[var(--bokmoo-line)] pl-0 lg:pl-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx(Link2, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-[var(--bokmoo-ink)]", children: title })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-5 divide-y divide-[var(--bokmoo-line)] border-y border-[var(--bokmoo-line)]", children: items.length ? items.map((item) => /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[1fr_auto] gap-4 py-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "truncate text-sm text-[var(--bokmoo-ink)]", children: orderId(item) }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: createdAt(item) ? new Date(createdAt(item)).toLocaleDateString() : item.status })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-sm font-semibold text-[var(--bokmoo-ink)]", children: [
            item.currency,
            " ",
            Number(item.amount).toFixed(2)
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs uppercase text-[var(--bokmoo-copy-soft)]", children: item.status })
        ] })
      ] }, item.id)) : /* @__PURE__ */ jsxs("div", { className: "py-10 text-center", children: [
        /* @__PURE__ */ jsx(UsersRound, { className: "mx-auto h-5 w-5 text-[var(--bokmoo-copy-soft)]" }),
        /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[var(--bokmoo-copy-soft)]", children: "No commissions yet" })
      ] }) })
    ] });
  }

  // ../../ui/src/utils/cn.ts
  function cn2(...inputs) {
    return twMerge(clsx(inputs));
  }

  // ../../ui/src/utils/a11y.ts
  function prefersReducedMotion3() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ../../ui/src/components/Button/Button.tsx
  var variantStyles2 = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-brand-sm hover:shadow-brand-md",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    destructive: "bg-red-600 text-white hover:bg-red-700"
  };
  var sizeStyles2 = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-base",
    lg: "h-12 px-6 text-lg"
  };
  var Spinner2 = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      className: "animate-spin -ml-1 mr-2 h-4 w-4",
      fill: "none",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx(
          "circle",
          {
            className: "opacity-25",
            cx: "12",
            cy: "12",
            r: "10",
            stroke: "currentColor",
            strokeWidth: "4"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            className: "opacity-75",
            fill: "currentColor",
            d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          }
        )
      ]
    }
  );
  var Button2 = forwardRef(
    ({
      variant = "primary",
      size = "md",
      loading = false,
      className,
      children,
      disabled,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion3();
      return /* @__PURE__ */ jsxs(
        motion.button,
        {
          ref,
          whileHover: reducedMotion ? void 0 : { scale: 1.02 },
          whileTap: reducedMotion ? void 0 : { scale: 0.98 },
          transition: { duration: 0.15 },
          className: cn2(
            // Base styles
            "inline-flex items-center justify-center font-medium rounded-full",
            "transition-all duration-fast",
            // Focus styles
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            // Disabled styles
            "disabled:opacity-50 disabled:pointer-events-none",
            // Variant styles
            variantStyles2[variant],
            // Size styles
            sizeStyles2[size],
            className
          ),
          disabled: disabled || loading,
          "aria-busy": loading,
          ...props,
          children: [
            loading && /* @__PURE__ */ jsx(Spinner2, {}),
            children
          ]
        }
      );
    }
  );
  Button2.displayName = "Button";

  // ../../ui/src/components/Card/ProductCard.tsx
  var aspectRatioStyles2 = {
    square: "aspect-square",
    portrait: "aspect-[4/5]",
    landscape: "aspect-video"
  };
  var badgeStyles2 = {
    NEW: "bg-blue-50 text-blue-600",
    SALE: "bg-red-50 text-red-600",
    HOT: "bg-orange-50 text-orange-600"
  };
  var ProductCard2 = forwardRef(
    ({
      image,
      title,
      description,
      price,
      originalPrice,
      badge,
      aspectRatio: aspectRatio2 = "portrait",
      currency = "\xA5",
      onAddToCart,
      className,
      ...props
    }, ref) => {
      const reducedMotion = prefersReducedMotion3();
      return /* @__PURE__ */ jsxs(
        motion.div,
        {
          ref,
          initial: reducedMotion ? void 0 : { opacity: 0, y: 20 },
          whileInView: reducedMotion ? void 0 : { opacity: 1, y: 0 },
          viewport: { once: true },
          whileHover: reducedMotion ? void 0 : { y: -8 },
          transition: { duration: 0.3, ease: [0, 0, 0.2, 1] },
          className: cn2("group cursor-pointer", className),
          ...props,
          children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: cn2(
                  "bg-slate-50 rounded-2xl mb-4 overflow-hidden relative",
                  "shadow-sm transition-all duration-normal",
                  "group-hover:shadow-card-hover",
                  "border border-transparent group-hover:border-blue-100",
                  aspectRatioStyles2[aspectRatio2]
                ),
                children: [
                  image ? /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: image,
                      alt: title,
                      className: "w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
                    }
                  ) : /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-tr from-slate-100 to-white" }),
                  badge && /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: cn2(
                        "absolute top-3 right-3",
                        "bg-white/90 backdrop-blur px-2.5 py-1 rounded-full",
                        "text-xs font-bold shadow-sm",
                        badgeStyles2[badge]
                      ),
                      children: badge
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal" })
                ]
              }
            ),
            /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2", children: title }),
            description && /* @__PURE__ */ jsx("p", { className: "text-slate-500 text-sm mb-2 line-clamp-2", children: description }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxs("span", { className: "text-lg font-bold text-slate-900", children: [
                  currency,
                  price.toLocaleString()
                ] }),
                originalPrice && /* @__PURE__ */ jsxs("span", { className: "text-sm text-slate-400 line-through", children: [
                  currency,
                  originalPrice.toLocaleString()
                ] })
              ] }),
              onAddToCart && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onAddToCart();
                  },
                  className: cn2(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "bg-blue-50 text-blue-600",
                    "hover:bg-blue-600 hover:text-white",
                    "transition-all duration-fast shadow-sm hover:shadow-brand-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  ),
                  "aria-label": `Add ${title} to cart`,
                  children: /* @__PURE__ */ jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) })
                }
              )
            ] })
          ]
        }
      );
    }
  );
  ProductCard2.displayName = "ProductCard";

  // ../../ui/src/components/Input/Input.tsx
  var Input2 = forwardRef(
    ({
      label,
      error,
      hint,
      prefixIcon,
      suffixIcon,
      className,
      id: id3,
      disabled,
      ...props
    }, ref) => {
      const generatedId = useId();
      const inputId = id3 || generatedId;
      const errorId = `${inputId}-error`;
      const hintId = `${inputId}-hint`;
      const hasError = !!error;
      return /* @__PURE__ */ jsxs("div", { className: "w-full", children: [
        label && /* @__PURE__ */ jsx(
          "label",
          {
            htmlFor: inputId,
            className: "block text-sm font-medium text-slate-700 mb-1.5",
            children: label
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          prefixIcon && /* @__PURE__ */ jsx("div", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: prefixIcon }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref,
              id: inputId,
              className: cn2(
                // Base styles
                "w-full h-10 px-4 rounded-lg border bg-white",
                "text-slate-900 placeholder:text-slate-400",
                "transition-all duration-fast",
                // Focus styles
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                // Error styles
                hasError ? "border-red-500 focus:ring-red-500" : "border-slate-200 hover:border-slate-300",
                // Disabled styles
                disabled && "bg-slate-50 text-slate-500 cursor-not-allowed",
                // Icon padding
                prefixIcon && "pl-10",
                suffixIcon && "pr-10",
                className
              ),
              disabled,
              "aria-invalid": hasError ? "true" : void 0,
              "aria-describedby": hasError ? errorId : hint ? hintId : void 0,
              ...props
            }
          ),
          suffixIcon && /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none", children: suffixIcon })
        ] }),
        hasError && /* @__PURE__ */ jsxs(
          "p",
          {
            id: errorId,
            className: "mt-1.5 text-sm text-red-600 flex items-center gap-1",
            role: "alert",
            children: [
              /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx(
                "path",
                {
                  fillRule: "evenodd",
                  d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
                  clipRule: "evenodd"
                }
              ) }),
              error
            ]
          }
        ),
        hint && !hasError && /* @__PURE__ */ jsx("p", { id: hintId, className: "mt-1.5 text-sm text-slate-500", children: hint })
      ] });
    }
  );
  Input2.displayName = "Input";

  // ../../ui/src/components/Navigation/Navigation.tsx
  function Navigation2({ logo, items, actions, className }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const reducedMotion = prefersReducedMotion3();
    useEffect(() => {
      const handleScroll = () => setScrolled(window.scrollY > 0);
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth >= 768) {
          setMobileMenuOpen(false);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    return /* @__PURE__ */ jsxs(
      "nav",
      {
        className: cn2(
          "sticky top-0 z-50 h-16 bg-white/90 backdrop-blur-md transition-all duration-normal",
          scrolled && "border-b border-slate-100 shadow-sm",
          className
        ),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("div", { className: "flex-shrink-0", children: logo }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex gap-8 text-sm font-medium", children: items.map((item) => /* @__PURE__ */ jsx(
              "a",
              {
                href: item.href,
                className: cn2(
                  "transition-colors duration-fast",
                  item.active ? "text-blue-600 font-semibold" : "text-slate-500 hover:text-blue-600"
                ),
                "aria-current": item.active ? "page" : void 0,
                children: item.label
              },
              item.href
            )) }),
            /* @__PURE__ */ jsx("div", { className: "hidden md:flex items-center gap-4", children: actions }),
            /* @__PURE__ */ jsx(
              "button",
              {
                className: cn2(
                  "md:hidden p-2 -mr-2 rounded-lg",
                  "text-slate-600 hover:bg-slate-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                ),
                onClick: () => setMobileMenuOpen(!mobileMenuOpen),
                "aria-label": mobileMenuOpen ? "Close menu" : "Open menu",
                "aria-expanded": mobileMenuOpen,
                "aria-controls": "mobile-menu",
                children: /* @__PURE__ */ jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: mobileMenuOpen ? /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M6 18L18 6M6 6l12 12" }) : /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M4 6h16M4 12h16M4 18h16" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(AnimatePresence, { children: mobileMenuOpen && /* @__PURE__ */ jsx(
            motion.div,
            {
              id: "mobile-menu",
              initial: reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 },
              animate: reducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" },
              exit: reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 },
              transition: { duration: 0.2 },
              className: "md:hidden bg-white border-t border-slate-100 overflow-hidden",
              children: /* @__PURE__ */ jsxs("div", { className: "py-4 px-4 sm:px-6 space-y-1", children: [
                items.map((item) => /* @__PURE__ */ jsx(
                  "a",
                  {
                    href: item.href,
                    className: cn2(
                      "block py-2.5 px-3 rounded-lg text-base transition-colors",
                      item.active ? "text-blue-600 font-semibold bg-blue-50" : "text-slate-600 hover:bg-slate-50"
                    ),
                    onClick: () => setMobileMenuOpen(false),
                    children: item.label
                  },
                  item.href
                )),
                actions && /* @__PURE__ */ jsx("div", { className: "mt-4 pt-4 border-t border-slate-100", children: actions })
              ] })
            }
          ) })
        ]
      }
    );
  }
  Navigation2.displayName = "Navigation";

  // ../../ui/src/components/Grid/ProductGrid.tsx
  var gapStyles2 = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8"
  };
  function ProductGrid2({
    children,
    columns = { sm: 2, md: 3, lg: 4 },
    gap = "md",
    className
  }) {
    const columnClasses = cn2(
      "grid-cols-1",
      columns.sm && `sm:grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`
    );
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: cn2(
          "grid",
          columnClasses,
          gapStyles2[gap],
          className
        ),
        children
      }
    );
  }
  ProductGrid2.displayName = "ProductGrid";

  // src/components/CartPage.tsx
  var CartPage = react_default.memo(function CartPage2({
    cart,
    isLoading,
    onUpdateQuantity,
    onRemoveItem,
    onCheckout,
    onCheckoutSelected,
    selectedItemIds,
    selectedItemCount,
    onToggleItemSelection,
    onSelectAllItems,
    onDeselectAllItems,
    onContinueShopping,
    locale
  }) {
    const t = (copy) => pickCopy(locale, copy);
    const supportsSelection = Boolean(
      onCheckoutSelected && onToggleItemSelection && onSelectAllItems && onDeselectAllItems
    );
    const effectiveSelectedIds = supportsSelection ? selectedItemIds || [] : cart.items.map((item) => item.id);
    const selectedIdSet = new Set(effectiveSelectedIds);
    const selectedItems = supportsSelection ? cart.items.filter((item) => selectedIdSet.has(item.id)) : cart.items;
    const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const ratio = cart.subtotal > 0 ? selectedSubtotal / cart.subtotal : 0;
    const selectedTax = Number(((cart.tax || 0) * ratio).toFixed(2));
    const selectedShipping = Number(((cart.shipping || 0) * ratio).toFixed(2));
    const selectedDiscount = Number(((cart.discount || 0) * ratio).toFixed(2));
    const selectedTotal = Number((selectedSubtotal + selectedTax + selectedShipping - selectedDiscount).toFixed(2));
    const selectedQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const allSelected = cart.items.length > 0 && effectiveSelectedIds.length === cart.items.length;
    const hasSelection = effectiveSelectedIds.length > 0;
    if (cart.items.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[960px]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-6 py-16 text-center shadow-[var(--bokmoo-shadow)] sm:px-10", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(ShoppingBag, { className: "h-10 w-10" }) }),
        /* @__PURE__ */ jsx("h1", { className: "mt-6 text-[clamp(2.2rem,4vw,4rem)] leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "Your cart is empty.", hans: "\u8D2D\u7269\u8F66\u662F\u7A7A\u7684\u3002", hant: "\u8CFC\u7269\u8ECA\u662F\u7A7A\u7684\u3002" }) }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--bokmoo-copy)]", children: t({ en: "Add a destination or regional plan to prepare your connectivity before departure.", hans: "\u6DFB\u52A0\u76EE\u7684\u5730\u6216\u533A\u57DF\u5957\u9910\uFF0C\u51FA\u53D1\u524D\u5907\u597D\u8FDE\u63A5\u3002", hant: "\u6DFB\u52A0\u76EE\u7684\u5730\u6216\u5340\u57DF\u5957\u9910\uFF0C\u51FA\u767C\u524D\u5099\u597D\u9023\u63A5\u3002" }) }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onContinueShopping,
            className: "mt-8 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
            type: "button",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              t({ en: "Continue browsing", hans: "\u7EE7\u7EED\u901B\u5E97", hant: "\u7E7C\u7E8C\u901B\u5E97" })
            ]
          }
        )
      ] }) }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onContinueShopping,
            className: "flex h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-copy)]",
            type: "button",
            children: /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", children: t({ en: "Travel Cart", hans: "\u65C5\u884C\u8D2D\u7269\u8F66", hant: "\u65C5\u884C\u8CFC\u7269\u8ECA" }) }),
          /* @__PURE__ */ jsx("h1", { className: "mt-1 text-[clamp(2rem,4vw,3.6rem)] leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "Review your selected plans.", hans: "\u786E\u8BA4\u4F60\u9009\u62E9\u7684\u5957\u9910\u3002", hant: "\u78BA\u8A8D\u4F60\u9078\u64C7\u7684\u5957\u9910\u3002" }) })
        ] })
      ] }),
      supportsSelection ? /* @__PURE__ */ jsxs("div", { className: "mt-5 flex items-center justify-between rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-4 shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => {
              if (allSelected) {
                onDeselectAllItems?.();
                return;
              }
              onSelectAllItems?.();
            },
            className: "inline-flex items-center gap-2 text-sm font-medium text-[var(--bokmoo-copy)]",
            children: [
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: cn2(
                    "flex h-5 w-5 items-center justify-center rounded-md border",
                    allSelected ? "border-[var(--bokmoo-gold)] bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] text-transparent"
                  ),
                  children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5" })
                }
              ),
              allSelected ? t({ en: "Deselect all", hans: "\u53D6\u6D88\u5168\u9009", hant: "\u53D6\u6D88\u5168\u9078" }) : t({ en: "Select all", hans: "\u5168\u9009", hant: "\u5168\u9078" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-xs font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
          selectedItemCount ?? effectiveSelectedIds.length,
          " ",
          t({ en: "selected", hans: "\u5DF2\u9009", hant: "\u5DF2\u9078" })
        ] })
      ] }) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.98fr)_minmax(22rem,0.72fr)]", children: [
        /* @__PURE__ */ jsx("section", { className: "space-y-4", children: cart.items.map((item) => /* @__PURE__ */ jsx(
          "article",
          {
            className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-5 shadow-[var(--bokmoo-shadow)]",
            children: /* @__PURE__ */ jsxs("div", { className: "flex gap-4", children: [
              supportsSelection ? /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => onToggleItemSelection?.(item.id),
                  className: cn2(
                    "mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors",
                    selectedIdSet.has(item.id) ? "border-[var(--bokmoo-gold)] bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] text-transparent"
                  ),
                  "aria-label": selectedIdSet.has(item.id) ? "Deselect item" : "Select item",
                  children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5" })
                }
              ) : null,
              /* @__PURE__ */ jsx("div", { className: "relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[linear-gradient(155deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_55%),var(--bokmoo-bg)]", children: item.productImage ? /* @__PURE__ */ jsx("img", { src: item.productImage, alt: item.productName, className: "h-full w-full object-cover" }) : /* @__PURE__ */ jsx("div", { className: "flex h-full items-end p-3 text-[10px] tracking-[0.16em] text-[var(--bokmoo-gold)]", children: "BOKMOO" }) }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx("h2", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: item.productName }),
                item.variantName ? /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: item.variantName }) : null,
                /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[var(--bokmoo-copy)]", children: t({ en: "Instant eSIM delivery with activation instructions included.", hans: "\u5373\u65F6\u9001\u8FBE eSIM\uFF0C\u542B\u6FC0\u6D3B\u8BF4\u660E\u3002", hant: "\u5373\u6642\u9001\u9054 eSIM\uFF0C\u542B\u555F\u7528\u8AAA\u660E\u3002" }) }),
                /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center gap-3", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-2 py-1", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => onUpdateQuantity(item.id, item.quantity - 1),
                        disabled: isLoading || item.quantity <= 1,
                        className: "flex h-8 w-8 items-center justify-center rounded-full text-[var(--bokmoo-copy)] disabled:opacity-40",
                        type: "button",
                        children: /* @__PURE__ */ jsx(Minus, { className: "h-4 w-4" })
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "min-w-[2rem] text-center text-sm font-medium text-[var(--bokmoo-ink)]", children: item.quantity }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => onUpdateQuantity(item.id, item.quantity + 1),
                        disabled: isLoading || item.quantity >= item.maxQuantity,
                        className: "flex h-8 w-8 items-center justify-center rounded-full text-[var(--bokmoo-copy)] disabled:opacity-40",
                        type: "button",
                        children: /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" })
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => onRemoveItem(item.id),
                      disabled: isLoading,
                      className: "flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] text-[var(--bokmoo-copy)] transition-colors hover:text-[var(--bokmoo-danger)] disabled:opacity-40",
                      title: t({ en: "Remove", hans: "\u5220\u9664", hant: "\u522A\u9664" }),
                      type: "button",
                      children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: t({ en: "Subtotal", hans: "\u5C0F\u8BA1", hant: "\u5C0F\u8A08" }) }),
                /* @__PURE__ */ jsxs("p", { className: "mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                  "$",
                  item.subtotal.toFixed(2)
                ] })
              ] })
            ] })
          },
          item.id
        )) }),
        /* @__PURE__ */ jsx("aside", { className: "lg:col-span-1", children: /* @__PURE__ */ jsxs("div", { className: "sticky top-24 rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: t({ en: "Summary", hans: "\u6458\u8981", hant: "\u6458\u8981" }) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: t({ en: "Selected items", hans: "\u5DF2\u9009\u5546\u54C1", hant: "\u5DF2\u9078\u5546\u54C1" }) }),
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-ink)]", children: supportsSelection ? selectedQuantity : cart.itemCount })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: t({ en: "Subtotal", hans: "\u5C0F\u8BA1", hant: "\u5C0F\u8A08" }) }),
              /* @__PURE__ */ jsxs("span", { className: "text-[var(--bokmoo-ink)]", children: [
                "$",
                selectedSubtotal.toFixed(2)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: t({ en: "Tax", hans: "\u7A0E\u8D39", hant: "\u7A05\u8CBB" }) }),
              /* @__PURE__ */ jsxs("span", { className: "text-[var(--bokmoo-ink)]", children: [
                "$",
                selectedTax.toFixed(2)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy)]", children: t({ en: "Shipping", hans: "\u8FD0\u8D39", hant: "\u904B\u8CBB" }) }),
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-ink)]", children: selectedShipping === 0 ? t({ en: "No shipping required", hans: "\u65E0\u9700\u8FD0\u8D39", hant: "\u7121\u9700\u904B\u8CBB" }) : `$${selectedShipping.toFixed(2)}` })
            ] }),
            selectedDiscount > 0 ? /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm text-[var(--bokmoo-success)]", children: [
              /* @__PURE__ */ jsx("span", { children: t({ en: "Discount", hans: "\u4F18\u60E0", hant: "\u512A\u60E0" }) }),
              /* @__PURE__ */ jsxs("span", { children: [
                "-$",
                selectedDiscount.toFixed(2)
              ] })
            ] }) : null,
            /* @__PURE__ */ jsx("div", { className: "border-t border-[var(--bokmoo-line)] pt-4", children: /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-lg", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-ink)]", children: t({ en: "Total", hans: "\u603B\u8BA1", hant: "\u7E3D\u8A08" }) }),
              /* @__PURE__ */ jsxs("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: [
                "$",
                selectedTotal.toFixed(2)
              ] })
            ] }) })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                if (supportsSelection && hasSelection) {
                  onCheckoutSelected?.(effectiveSelectedIds);
                  return;
                }
                onCheckout();
              },
              disabled: supportsSelection && !hasSelection,
              className: "mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50",
              type: "button",
              children: t({ en: "Secure Checkout", hans: "\u5B89\u5168\u7ED3\u7B97", hant: "\u5B89\u5168\u7D50\u7B97" })
            }
          )
        ] }) })
      ] })
    ] }) });
  });

  // src/components/CategoriesPage.tsx
  var CategoriesPage = react_default.memo(function CategoriesPage2({
    categories,
    isLoading,
    error,
    onCategoryClick,
    onNavigateToHome
  }) {
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsx("section", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Earth, { className: "h-6 w-6" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Region Collections" }),
          /* @__PURE__ */ jsx("h1", { className: "mt-2 text-[clamp(2.2rem,5vw,4rem)] leading-[0.94] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Browse BOKMOO plans by destination and travel region." })
        ] })
      ] }) }),
      error ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 text-[var(--bokmoo-copy)] shadow-[var(--bokmoo-shadow)]", children: error }) : null,
      /* @__PURE__ */ jsx("section", { className: "mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: categories.map((category) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => onCategoryClick(category.id),
          className: "group rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 text-left shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1",
          type: "button",
          children: [
            /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-gold)]", children: [
              category.productCount,
              " plans"
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 text-2xl leading-[1.02] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: category.name }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: category.description || "Group destination-ready plans into clearer regional entry points." }),
            /* @__PURE__ */ jsxs("span", { className: "mt-4 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-gold)]", children: [
              "View category",
              /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" })
            ] })
          ]
        },
        category.id
      )) }),
      categories.length === 0 ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]", children: "No region collections are available yet." }) : null,
      onNavigateToHome ? /* @__PURE__ */ jsx("div", { className: "mt-8", children: /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onNavigateToHome,
          className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
          type: "button",
          children: "Back home"
        }
      ) }) : null
    ] }) });
  });

  // src/components/CheckoutPage.tsx
  var CheckoutPage = react_default.memo(function CheckoutPage2({
    cart,
    isLoading,
    isProcessing,
    requireShippingAddress,
    countriesRequireStatePostal,
    currentUserEmail,
    availablePaymentMethods,
    onSubmit,
    onBack,
    savedAddress,
    savedAddresses,
    onPickSavedAddress,
    locale
  }) {
    const countriesRequireStatePostalSet = react_default.useMemo(() => {
      const source = countriesRequireStatePostal && countriesRequireStatePostal.length > 0 ? countriesRequireStatePostal : ["US", "CA", "AU", "CN", "GB"];
      return new Set(source.map((item) => item.trim().toUpperCase()));
    }, [countriesRequireStatePostal]);
    const paymentMethods = react_default.useMemo(() => availablePaymentMethods || [], [availablePaymentMethods]);
    const [formData, setFormData] = react_default.useState({
      email: savedAddress?.email || currentUserEmail || "",
      firstName: savedAddress?.firstName || "",
      lastName: savedAddress?.lastName || "",
      addressLine1: savedAddress?.addressLine1 || "",
      city: savedAddress?.city || "",
      state: savedAddress?.state || "",
      postalCode: savedAddress?.postalCode || "",
      country: savedAddress?.country || "",
      phone: savedAddress?.phone || "",
      paymentMethod: paymentMethods[0]?.name || "",
      promoCode: ""
    });
    const [errors, setErrors] = react_default.useState({});
    const [selectedSavedAddressId, setSelectedSavedAddressId] = react_default.useState(
      savedAddresses?.find((address) => address.isDefault)?.id ?? savedAddresses?.[0]?.id ?? null
    );
    react_default.useEffect(() => {
      if (!savedAddress) return;
      setFormData((prev) => ({
        ...prev,
        email: prev.email || savedAddress.email || "",
        firstName: prev.firstName || savedAddress.firstName || "",
        lastName: prev.lastName || savedAddress.lastName || "",
        phone: prev.phone || savedAddress.phone || "",
        addressLine1: prev.addressLine1 || savedAddress.addressLine1 || "",
        city: prev.city || savedAddress.city || "",
        state: prev.state || savedAddress.state || "",
        postalCode: prev.postalCode || savedAddress.postalCode || "",
        country: prev.country || savedAddress.country || ""
      }));
    }, [savedAddress]);
    react_default.useEffect(() => {
      if (!currentUserEmail) return;
      setFormData((prev) => ({ ...prev, email: prev.email || currentUserEmail }));
    }, [currentUserEmail]);
    react_default.useEffect(() => {
      if (!paymentMethods.length) return;
      if (paymentMethods.some((item) => item.name === formData.paymentMethod)) return;
      setFormData((prev) => ({ ...prev, paymentMethod: paymentMethods[0].name }));
    }, [formData.paymentMethod, paymentMethods]);
    const hasShippingInput = react_default.useMemo(
      () => [
        formData.firstName,
        formData.lastName,
        formData.phone,
        formData.addressLine1,
        formData.city,
        formData.state,
        formData.postalCode,
        formData.country
      ].some((value) => value.trim()),
      [formData]
    );
    const shouldCollectShipping = Boolean(requireShippingAddress || hasShippingInput);
    const normalizedCountry = formData.country.trim().toUpperCase() === "UK" ? "GB" : formData.country.trim().toUpperCase();
    const statePostalRequired = shouldCollectShipping && countriesRequireStatePostalSet.has(normalizedCountry);
    const inputClassName = (field) => cn2(
      "h-12 w-full rounded-[0.95rem] border bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]",
      errors[field] ? "border-[var(--bokmoo-danger)]" : "border-[var(--bokmoo-line)]"
    );
    const handleChange = (event) => {
      const { name, value } = event.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    };
    const validate = () => {
      const nextErrors = {};
      if (!formData.email.trim()) nextErrors.email = pickCopy(locale, { en: "Email is required", hans: "\u8BF7\u8F93\u5165\u90AE\u7BB1", hant: "\u8ACB\u8F38\u5165\u90F5\u7BB1" });
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) nextErrors.email = pickCopy(locale, { en: "Invalid email address", hans: "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E", hant: "\u90F5\u7BB1\u683C\u5F0F\u4E0D\u6B63\u78BA" });
      if (shouldCollectShipping) {
        if (!formData.firstName.trim()) nextErrors.firstName = pickCopy(locale, { en: "First name is required", hans: "\u8BF7\u8F93\u5165\u540D\u5B57", hant: "\u8ACB\u8F38\u5165\u540D\u5B57" });
        if (!formData.addressLine1.trim()) nextErrors.addressLine1 = pickCopy(locale, { en: "Address is required", hans: "\u8BF7\u8F93\u5165\u5730\u5740", hant: "\u8ACB\u8F38\u5165\u5730\u5740" });
        if (!formData.city.trim()) nextErrors.city = pickCopy(locale, { en: "City is required", hans: "\u8BF7\u8F93\u5165\u57CE\u5E02", hant: "\u8ACB\u8F38\u5165\u57CE\u5E02" });
        if (!formData.country.trim()) nextErrors.country = pickCopy(locale, { en: "Country is required", hans: "\u8BF7\u9009\u62E9\u56FD\u5BB6/\u5730\u533A", hant: "\u8ACB\u9078\u64C7\u570B\u5BB6/\u5730\u5340" });
        if (!formData.phone.trim()) nextErrors.phone = pickCopy(locale, { en: "Phone number is required", hans: "\u8BF7\u8F93\u5165\u7535\u8BDD\u53F7\u7801", hant: "\u8ACB\u8F38\u5165\u96FB\u8A71\u865F\u78BC" });
        if (statePostalRequired) {
          if (!formData.state.trim()) nextErrors.state = pickCopy(locale, { en: "State is required", hans: "\u8BF7\u8F93\u5165\u7701/\u5DDE", hant: "\u8ACB\u8F38\u5165\u7701/\u5DDE" });
          if (!formData.postalCode.trim()) nextErrors.postalCode = pickCopy(locale, { en: "Postal code is required", hans: "\u8BF7\u8F93\u5165\u90AE\u7F16", hant: "\u8ACB\u8F38\u5165\u90F5\u905E\u5340\u865F" });
        }
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!validate()) return;
      await onSubmit(formData);
    };
    const paymentIcon = (name) => {
      const normalized = name.toLowerCase();
      return normalized.includes("card") || normalized.includes("stripe") ? CreditCard : Wallet;
    };
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onBack,
          className: "inline-flex items-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-ink)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            pickCopy(locale, { en: "Back", hans: "\u8FD4\u56DE", hant: "\u8FD4\u56DE" })
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "mt-5 rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-3 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.55rem] sm:p-5", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]", children: [
        /* @__PURE__ */ jsxs("aside", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
          /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Order Summary", hans: "\u8BA2\u5355\u6458\u8981", hant: "\u8A02\u55AE\u6458\u8981" }) }),
          /* @__PURE__ */ jsx("div", { className: "mt-4 space-y-3", children: cart.items.map((item) => /* @__PURE__ */ jsx("div", { className: "rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_84%,black)] p-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "h-14 w-16 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: item.productName }),
              /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: [
                pickCopy(locale, { en: "Qty", hans: "\u6570\u91CF", hant: "\u6578\u91CF" }),
                " ",
                item.quantity,
                item.variantName ? ` \xB7 ${item.variantName}` : ""
              ] })
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "text-sm text-[var(--bokmoo-copy)]", children: [
              "$",
              Number(item.subtotal || 0).toFixed(2)
            ] })
          ] }) }, item.id)) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-3 border-t border-[var(--bokmoo-line)] pt-4 text-sm", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx("span", { children: pickCopy(locale, { en: "Subtotal", hans: "\u5C0F\u8BA1", hant: "\u5C0F\u8A08" }) }),
              /* @__PURE__ */ jsxs("span", { children: [
                "$",
                Number(cart.subtotal || 0).toFixed(2)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx("span", { children: pickCopy(locale, { en: "Total", hans: "\u603B\u8BA1", hant: "\u7E3D\u8A08" }) }),
              /* @__PURE__ */ jsxs("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: [
                "$",
                Number(cart.total || 0).toFixed(2)
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("form", { id: "bokmoo-checkout-form", onSubmit: handleSubmit, className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[var(--bokmoo-bg)] p-4", children: [
            /* @__PURE__ */ jsx("label", { className: "text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", htmlFor: "bokmoo-promo-code", children: pickCopy(locale, { en: "Promo / referral code", hans: "\u4F18\u60E0\u7801 / \u63A8\u8350\u7801", hant: "\u512A\u60E0\u78BC / \u63A8\u85A6\u78BC" }) }),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: "bokmoo-promo-code",
                value: formData.promoCode,
                onChange: (event) => setFormData((prev) => ({ ...prev, promoCode: event.target.value.toUpperCase() })),
                placeholder: pickCopy(locale, { en: "e.g. BOKMOO10", hans: "\u5982 BOKMOO10", hant: "\u5982 BOKMOO10" }),
                className: "mt-2 h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm font-semibold tracking-[0.08em] text-[var(--bokmoo-ink)] outline-none focus:border-[var(--bokmoo-gold)]"
              }
            ),
            /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Have a referral code from a creator? Enter it \u2014 your discount is applied to the order total at payment.", hans: "\u6709\u521B\u4F5C\u8005\u7684\u63A8\u8350\u7801\uFF1F\u8F93\u5165\u540E\u4F18\u60E0\u4F1A\u5728\u652F\u4ED8\u65F6\u8BA1\u5165\u8BA2\u5355\u603B\u989D\u3002", hant: "\u6709\u5275\u4F5C\u8005\u7684\u63A8\u85A6\u78BC\uFF1F\u8F38\u5165\u5F8C\u512A\u60E0\u6703\u5728\u4ED8\u6B3E\u6642\u8A08\u5165\u8A02\u55AE\u7E3D\u984D\u3002" }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Mail, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Contact Information", hans: "\u8054\u7CFB\u4FE1\u606F", hant: "\u806F\u7D61\u8CC7\u8A0A" }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-3", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "email",
                  type: "email",
                  value: formData.email,
                  onChange: handleChange,
                  className: inputClassName("email"),
                  placeholder: pickCopy(locale, { en: "Enter your email", hans: "\u8BF7\u8F93\u5165\u90AE\u7BB1", hant: "\u8ACB\u8F38\u5165\u90F5\u7BB1" })
                }
              ),
              errors.email ? /* @__PURE__ */ jsx("p", { className: "text-xs text-[var(--bokmoo-danger)]", children: errors.email }) : null,
              /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      name: "firstName",
                      value: formData.firstName,
                      onChange: handleChange,
                      className: inputClassName("firstName"),
                      placeholder: pickCopy(locale, { en: "First name", hans: "\u540D\u5B57", hant: "\u540D\u5B57" })
                    }
                  ),
                  errors.firstName ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-danger)]", children: errors.firstName }) : null
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      name: "lastName",
                      value: formData.lastName,
                      onChange: handleChange,
                      className: inputClassName("lastName"),
                      placeholder: pickCopy(locale, { en: "Last name", hans: "\u59D3\u6C0F", hant: "\u59D3\u6C0F" })
                    }
                  ),
                  errors.lastName ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-danger)]", children: errors.lastName }) : null
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Payment Method", hans: "\u652F\u4ED8\u65B9\u5F0F", hant: "\u4ED8\u6B3E\u65B9\u5F0F" }) }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: paymentMethods.map((method) => {
              const Icon2 = paymentIcon(method.name);
              const isSelected = formData.paymentMethod === method.name;
              return /* @__PURE__ */ jsxs(
                "label",
                {
                  className: cn2(
                    "flex cursor-pointer items-center justify-between rounded-[0.95rem] border px-4 py-4 transition-colors",
                    isSelected ? "border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)]" : "border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)]"
                  ),
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-4 w-4" }) }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--bokmoo-ink)]", children: method.displayName }),
                        /* @__PURE__ */ jsx("p", { className: "text-xs text-[var(--bokmoo-copy-soft)]", children: method.name })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "radio",
                        name: "paymentMethod",
                        value: method.name,
                        checked: isSelected,
                        onChange: handleChange
                      }
                    )
                  ]
                },
                method.name
              );
            }) })
          ] }),
          shouldCollectShipping ? /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            (savedAddresses?.length ?? 0) > 0 && onPickSavedAddress ? /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
              /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Saved addresses", hans: "\u5DF2\u4FDD\u5B58\u5730\u5740", hant: "\u5DF2\u4FDD\u5B58\u5730\u5740" }) }),
              /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: (savedAddresses ?? []).map((address) => {
                const active = selectedSavedAddressId === address.id;
                return /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => {
                      setSelectedSavedAddressId(address.id);
                      onPickSavedAddress(address);
                    },
                    className: `rounded-[1rem] border p-4 text-left transition-colors ${active ? "border-[var(--bokmoo-gold)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)]" : "border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_40%,transparent)]"}`,
                    type: "button",
                    children: [
                      /* @__PURE__ */ jsxs("span", { className: "flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--bokmoo-ink)]", children: [
                        address.name,
                        address.isDefault ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--bokmoo-gold)]", children: pickCopy(locale, { en: "Default", hans: "\u9ED8\u8BA4", hant: "\u9810\u8A2D" }) }) : null
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "mt-1 block text-xs text-[var(--bokmoo-copy)]", children: [
                        address.phone,
                        " \xB7 ",
                        address.line1,
                        address.city ? `, ${address.city}` : "",
                        address.country ? ` \xB7 ${address.country}` : ""
                      ] })
                    ]
                  },
                  address.id
                );
              }) })
            ] }) : null,
            /* @__PURE__ */ jsx("p", { className: "text-lg font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Billing Details", hans: "\u8D26\u5355\u4FE1\u606F", hant: "\u5E33\u55AE\u8CC7\u8A0A" }) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    name: "phone",
                    type: "tel",
                    value: formData.phone,
                    onChange: handleChange,
                    className: inputClassName("phone"),
                    placeholder: pickCopy(locale, { en: "Phone number", hans: "\u7535\u8BDD\u53F7\u7801", hant: "\u96FB\u8A71\u865F\u78BC" })
                  }
                ),
                errors.phone ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-danger)]", children: errors.phone }) : null
              ] }),
              /* @__PURE__ */ jsx("div", { className: "sm:col-span-2", children: /* @__PURE__ */ jsx(
                "input",
                {
                  name: "addressLine1",
                  value: formData.addressLine1,
                  onChange: handleChange,
                  className: inputClassName("addressLine1"),
                  placeholder: pickCopy(locale, { en: "Address", hans: "\u8BE6\u7EC6\u5730\u5740", hant: "\u8A73\u7D30\u5730\u5740" })
                }
              ) }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "city",
                  value: formData.city,
                  onChange: handleChange,
                  className: inputClassName("city"),
                  placeholder: pickCopy(locale, { en: "City", hans: "\u57CE\u5E02", hant: "\u57CE\u5E02" })
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "country",
                  value: formData.country,
                  onChange: handleChange,
                  className: inputClassName("country"),
                  placeholder: pickCopy(locale, { en: "Country", hans: "\u56FD\u5BB6/\u5730\u533A", hant: "\u570B\u5BB6/\u5730\u5340" })
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "state",
                  value: formData.state,
                  onChange: handleChange,
                  className: inputClassName("state"),
                  placeholder: pickCopy(locale, { en: "State / Province", hans: "\u7701/\u5DDE", hant: "\u7701/\u5DDE" })
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  name: "postalCode",
                  value: formData.postalCode,
                  onChange: handleChange,
                  className: inputClassName("postalCode"),
                  placeholder: pickCopy(locale, { en: "Postal code", hans: "\u90AE\u7F16", hant: "\u90F5\u905E\u5340\u865F" })
                }
              )
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "submit",
              form: "bokmoo-checkout-form",
              disabled: isProcessing,
              className: "btn-shimmer flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:cursor-not-allowed disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
                isProcessing ? pickCopy(locale, { en: "Processing\u2026", hans: "\u5904\u7406\u4E2D\u2026", hant: "\u8655\u7406\u4E2D\u2026" }) : pickCopy(locale, { en: "Continue to Payment", hans: "\u7EE7\u7EED\u524D\u5F80\u652F\u4ED8", hant: "\u7E7C\u7E8C\u524D\u5F80\u4ED8\u6B3E" })
              ]
            }
          )
        ] })
      ] }) })
    ] }) });
  });

  // src/lib/digital-fulfillment.ts
  function toRecord(input) {
    if (!input) return {};
    if (typeof input === "string") {
      try {
        const parsed = JSON.parse(input);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof input === "object" && !Array.isArray(input) ? input : {};
  }
  function normalizeWords(input) {
    return input.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  }
  function titleCase(input) {
    return normalizeWords(input).split(" ").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  function valueToText(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
  }
  function looksLikeUrl(value) {
    return /^https?:\/\//i.test(value);
  }
  function hasKeyword(source, keywords) {
    return keywords.some((keyword) => source.includes(keyword));
  }
  function buildSearchText(product) {
    if (!product) return "";
    const specs = (product.specifications || []).map((item) => `${item.name} ${item.value}`).join(" ");
    return [
      product.name,
      product.description,
      product.category?.name,
      ...product.tags || [],
      specs
    ].filter(Boolean).join(" ").toLowerCase();
  }
  function findSpecificationValue(product, keywords) {
    if (!product?.specifications?.length) return "";
    const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
    const match = product.specifications.find((spec) => {
      const haystack = `${spec.name} ${spec.group || ""}`.toLowerCase();
      return normalizedKeywords.some((keyword) => haystack.includes(keyword));
    });
    return match?.value?.trim() || "";
  }
  function extractByRegex(source, pattern) {
    const match = source.match(pattern);
    return match?.[1]?.trim() || match?.[0]?.trim() || "";
  }
  function pickCoverage(product, source) {
    return findSpecificationValue(product, ["coverage", "country", "countries", "destination", "region", "\u5730\u533A", "\u56FD\u5BB6", "\u8986\u76D6"]) || product?.category?.name || (product?.tags || []).find((tag) => !hasKeyword(tag.toLowerCase(), ["esim", "travel", "trip"])) || "200+ destinations";
  }
  function pickPlan(product, source) {
    return findSpecificationValue(product, ["data", "allowance", "plan", "package", "bundle", "\u6D41\u91CF", "\u5957\u9910"]) || extractByRegex(source, /\b(unlimited|\d+(?:\.\d+)?\s?(?:gb|mb|tb))\b/i) || "Flexible data bundle";
  }
  function pickDuration(product, source) {
    return findSpecificationValue(product, ["validity", "duration", "days", "period", "\u6709\u6548\u671F", "\u5929", "\u65E5"]) || extractByRegex(source, /\b(\d+\s?(?:day|days|week|weeks|month|months))\b/i) || "Flexible trip validity";
  }
  function pickNetwork(product, source) {
    const matchedSpeed = extractByRegex(source, /\b(5g|4g|lte)\b/i).toUpperCase();
    return findSpecificationValue(product, ["network", "speed", "carrier", "band", "\u7F51\u7EDC", "\u901F\u7387"]) || (matchedSpeed ? `${matchedSpeed} local carrier access` : "") || "Priority local carrier access";
  }
  function pickActivation(product, source) {
    if (hasKeyword(source, ["qr", "scan", "\u626B\u7801", "\u6FC0\u6D3B"])) {
      return "Install in seconds via QR";
    }
    return findSpecificationValue(product, ["activation", "delivery", "install", "setup", "\u6FC0\u6D3B", "\u5B89\u88C5", "\u4EA4\u4ED8"]) || "Instant eSIM delivery after payment";
  }
  function pickCompatibility(product) {
    return findSpecificationValue(product, ["compatibility", "device", "supported devices", "\u517C\u5BB9", "\u8BBE\u5907"]) || "Unlocked iPhone and Android devices with eSIM support";
  }
  function pickPlanBadge(planLabel) {
    if (/unlimited|无限/i.test(planLabel)) return "Unlimited";
    if (/\b\d+(?:\.\d+)?\s?(?:gb|mb|tb)\b/i.test(planLabel)) return planLabel;
    return "Travel bundle";
  }
  function getBokmooTravelProfile(product) {
    const source = buildSearchText(product);
    const coverageLabel = pickCoverage(product, source);
    const planLabel = pickPlan(product, source);
    const durationLabel = pickDuration(product, source);
    const networkLabel = pickNetwork(product, source);
    const activationLabel = pickActivation(product, source);
    const compatibilityLabel = pickCompatibility(product);
    const deliveryLabel = "Instant delivery via eSIM";
    const planBadge = pickPlanBadge(planLabel);
    const cardEyebrow = /global|world|europe|asia|全球|欧洲|亚洲/i.test(coverageLabel) ? "Global Plan" : "Destination eSIM";
    const specRows = [
      { label: "Coverage", value: coverageLabel },
      { label: "Plan", value: planLabel },
      { label: "Validity", value: durationLabel },
      { label: "Network", value: networkLabel },
      { label: "Activation", value: activationLabel },
      { label: "Compatibility", value: compatibilityLabel }
    ];
    return {
      coverageLabel,
      planLabel,
      durationLabel,
      networkLabel,
      activationLabel,
      compatibilityLabel,
      deliveryLabel,
      planBadge,
      cardEyebrow,
      summary: `${coverageLabel} \xB7 ${planLabel} \xB7 ${durationLabel}`,
      highlights: [planLabel, durationLabel, networkLabel],
      promises: [
        "Instant QR or eSIM profile delivery",
        "Keep your primary SIM in place",
        "Check compatibility before departure"
      ],
      specRows
    };
  }
  function flattenRecord(input, prefix = "") {
    const rows = [];
    for (const [rawKey, value] of Object.entries(input)) {
      if (value === null || value === void 0) continue;
      const key = prefix ? `${prefix}.${rawKey}` : rawKey;
      if (Array.isArray(value)) {
        rows.push({ key, value });
        continue;
      }
      if (typeof value === "object") {
        rows.push(...flattenRecord(value, key));
        continue;
      }
      rows.push({ key, value });
    }
    return rows;
  }
  function extractDeliverySections(fulfillmentData) {
    const data = toRecord(fulfillmentData);
    const sections3 = {
      codes: [],
      credentials: [],
      links: [],
      meta: [],
      notes: []
    };
    for (const row of flattenRecord(data)) {
      const { key, value } = row;
      if (value === null || value === void 0) continue;
      if (Array.isArray(value)) {
        if (value.every((item) => typeof item === "string")) {
          sections3.notes.push(...value.map((item) => String(item).trim()).filter(Boolean));
        }
        continue;
      }
      const text = valueToText(value);
      if (!text) continue;
      const normalizedKey = key.toLowerCase();
      const label = titleCase(key.split(".").slice(-1)[0] || key);
      if (looksLikeUrl(text)) {
        sections3.links.push({
          label,
          value: text,
          href: text,
          kind: "link"
        });
        continue;
      }
      if (hasKeyword(normalizedKey, ["instruction", "note", "remark", "hint"])) {
        sections3.notes.push(text);
        continue;
      }
      if (hasKeyword(normalizedKey, ["password", "secret", "username", "account", "login", "email"])) {
        sections3.credentials.push({
          label,
          value: text,
          kind: "credential",
          sensitive: hasKeyword(normalizedKey, ["password", "secret"])
        });
        continue;
      }
      if (hasKeyword(normalizedKey, ["code", "pin", "license", "serial", "token", "voucher", "redeem", "giftcard", "qr"])) {
        sections3.codes.push({
          label,
          value: text,
          kind: "code"
        });
        continue;
      }
      sections3.meta.push({
        label,
        value: text,
        kind: "meta"
      });
    }
    return sections3;
  }
  function getDeliveredArtifactCount(fulfillmentData) {
    const sections3 = extractDeliverySections(fulfillmentData);
    return sections3.codes.length + sections3.credentials.length + sections3.links.length;
  }

  // src/components/ProductsPage.tsx
  var CATALOG_FILTERS = ["All", "Popular", "Local", "Regional", "Global"];
  var FILTER_LABELS = {
    All: { en: "All", hans: "\u5168\u90E8", hant: "\u5168\u90E8" },
    Popular: { en: "Popular", hans: "\u70ED\u95E8", hant: "\u71B1\u9580" },
    Local: { en: "Local", hans: "\u672C\u5730", hant: "\u672C\u5730" },
    Regional: { en: "Regional", hans: "\u533A\u57DF", hant: "\u5340\u57DF" },
    Global: { en: "Global", hans: "\u5168\u7403", hant: "\u5168\u7403" }
  };
  var SORT_LABELS = {
    createdAt: { en: "Newest", hans: "\u6700\u65B0", hant: "\u6700\u65B0" },
    price: { en: "Price", hans: "\u4EF7\u683C", hant: "\u50F9\u683C" },
    name: { en: "Name", hans: "\u540D\u79F0", hant: "\u540D\u7A31" }
  };
  function getProductImage(product) {
    if (!product?.images?.length) return null;
    const primary = product.images.find((image) => image.isMain) || product.images[0];
    return primary?.url || null;
  }
  function productText(product) {
    const esim = product.typeData?.esim;
    return [product.name, product.description, esim?.country, esim?.region, esim?.carrier].filter(Boolean).join(" ").toLowerCase();
  }
  function matchesCatalogFilter(product, filter2) {
    const esim = product.typeData?.esim;
    const region = (esim?.region || "").toLowerCase();
    const country = (esim?.country || "").toLowerCase();
    if (filter2 === "All" || filter2 === "Popular") return true;
    if (filter2 === "Global") return region.includes("global") || country.includes("global");
    if (filter2 === "Regional") return Boolean(region && !region.includes("global") && region !== country);
    if (filter2 === "Local") return Boolean(country && (!region || region === country || !region.includes("global")));
    return true;
  }
  function ProductMedia({ product, apiBaseUrl }) {
    const image = resolveBokmooMediaUrl(getProductImage(product), apiBaseUrl);
    const profile = getBokmooTravelProfile(product);
    if (image) {
      return /* @__PURE__ */ jsx(
        "img",
        {
          src: image,
          alt: displayProductTitle(product.name),
          className: "h-full w-full object-cover"
        }
      );
    }
    return /* @__PURE__ */ jsxs("div", { className: "flex h-full w-full flex-col justify-between bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent),transparent_55%),linear-gradient(180deg,var(--bokmoo-bg-soft),var(--bokmoo-bg))] p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.2em] text-[var(--bokmoo-gold)]", children: profile.cardEyebrow }),
        /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy)]", children: profile.planBadge })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm tracking-[0.22em] text-[var(--bokmoo-copy-soft)]", children: "BOKMOO" }),
        /* @__PURE__ */ jsx("p", { className: "mt-3 text-2xl leading-[0.98] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: profile.coverageLabel })
      ] })
    ] });
  }
  var ProductsPage = react_default.memo(function ProductsPage2({
    products,
    isLoading,
    totalProducts,
    currentPage,
    totalPages,
    sortBy,
    viewMode,
    onSortChange,
    onViewModeChange,
    onPageChange,
    onAddToCart,
    onProductClick,
    onSearch,
    config,
    locale
  }) {
    const [searchQuery, setSearchQuery] = react_default.useState("");
    const [activeSearch, setActiveSearch] = react_default.useState("");
    const [remoteProducts, setRemoteProducts] = react_default.useState([]);
    const [remoteTotal, setRemoteTotal] = react_default.useState(0);
    const [remoteTotalPages, setRemoteTotalPages] = react_default.useState(1);
    const [remoteLoading, setRemoteLoading] = react_default.useState(false);
    const [remoteError, setRemoteError] = react_default.useState("");
    const [selectedFilter, setSelectedFilter] = react_default.useState("All");
    const site = resolveBokmooSiteConfig(config);
    const t = (copy) => pickCopy(locale, copy);
    const normalizedProducts = react_default.useMemo(
      () => (remoteProducts.length > 0 ? remoteProducts : products).map(
        (product) => normalizeProductForTheme(product)
      ),
      [products, remoteProducts]
    );
    const submitSearch = (event) => {
      event.preventDefault();
      if (onSearch) {
        onSearch(searchQuery.trim());
        return;
      }
      setActiveSearch(searchQuery.trim());
    };
    const loadRemoteProducts = react_default.useCallback(
      async (search = "") => {
        setRemoteLoading(true);
        setRemoteError("");
        try {
          const response = await getBokmooProducts(
            {
              baseUrl: site.apiBaseUrl
            },
            {
              page: currentPage || 1,
              limit: 12,
              locale: locale || "en",
              type: "esim"
            }
          );
          const filteredItems = search ? response.items.filter(
            (item) => productText(item).includes(search.toLowerCase())
          ) : response.items;
          const scopedItems = filteredItems.filter((item) => matchesCatalogFilter(item, selectedFilter));
          const isLocalScope = Boolean(search || selectedFilter !== "All");
          setRemoteProducts(scopedItems.map(mapBokmooApiProductToThemeProduct));
          setRemoteTotal(isLocalScope ? scopedItems.length : Number(response.total || scopedItems.length || 0));
          setRemoteTotalPages(Math.max(1, Math.ceil((isLocalScope ? scopedItems.length : Number(response.total || scopedItems.length || 0)) / 12)));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load Bokmoo plans.";
          setRemoteError(message);
          setRemoteProducts([]);
          setRemoteTotal(0);
          setRemoteTotalPages(1);
        } finally {
          setRemoteLoading(false);
        }
      },
      [currentPage, locale, selectedFilter, site.apiBaseUrl]
    );
    react_default.useEffect(() => {
      if (products.length > 0) return;
      void loadRemoteProducts(activeSearch);
    }, [activeSearch, loadRemoteProducts, products.length]);
    if (isLoading || remoteLoading && normalizedProducts.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    const displayTotal = remoteProducts.length > 0 ? remoteTotal : totalProducts;
    const displayTotalPages = remoteProducts.length > 0 ? remoteTotalPages : totalPages;
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsxs("section", { className: "rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent),transparent_34%),color-mix(in_oklab,var(--bokmoo-bg-elevated)_76%,black)] p-5 shadow-[var(--bokmoo-shadow)] sm:rounded-[var(--bokmoo-radius-xl)] sm:p-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "max-w-2xl", children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
              t({ en: "Plan collection", hans: "\u5957\u9910\u96C6\u5408", hant: "\u5957\u9910\u96C6\u5408" })
            ] }),
            /* @__PURE__ */ jsx("h1", { className: "mt-5 text-[clamp(2.3rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "eSIM plans built for every journey.", hans: "\u4E3A\u6BCF\u4E00\u6BB5\u65C5\u7A0B\u800C\u751F\u7684 eSIM \u5957\u9910\u3002", hant: "\u70BA\u6BCF\u4E00\u6BB5\u65C5\u7A0B\u800C\u751F\u7684 eSIM \u5957\u9910\u3002" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-base leading-7 text-[var(--bokmoo-copy)]", children: t({ en: "Explore destination-ready profiles, regional bundles, and premium data options with the clarity of a product catalog.", hans: "\u63A2\u7D22\u76EE\u7684\u5730\u5957\u9910\u3001\u533A\u57DF\u7EC4\u5408\u4E0E\u9AD8\u7EA7\u6D41\u91CF\u9009\u9879\uFF0C\u50CF\u5546\u54C1\u76EE\u5F55\u4E00\u6837\u4E00\u76EE\u4E86\u7136\u3002", hant: "\u63A2\u7D22\u76EE\u7684\u5730\u5957\u9910\u3001\u5340\u57DF\u7D44\u5408\u8207\u9AD8\u7D1A\u6D41\u91CF\u9078\u9805\uFF0C\u50CF\u5546\u54C1\u76EE\u9304\u4E00\u6A23\u4E00\u76EE\u4E86\u7136\u3002" }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:min-w-[34rem]", children: [
            /* @__PURE__ */ jsxs("form", { onSubmit: submitSearch, className: "relative", children: [
              /* @__PURE__ */ jsx(Search, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  value: searchQuery,
                  onChange: (event) => setSearchQuery(event.target.value),
                  placeholder: t({ en: "Search destinations or bundles...", hans: "\u641C\u7D22\u76EE\u7684\u5730\u6216\u5957\u9910\u2026", hant: "\u641C\u5C0B\u76EE\u7684\u5730\u6216\u5957\u9910\u2026" }),
                  className: "h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] pl-11 pr-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] sm:rounded-full"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: sortBy,
                onChange: (event) => onSortChange(event.target.value),
                className: "h-12 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none sm:rounded-full",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "createdAt", children: t(SORT_LABELS.createdAt) }),
                  /* @__PURE__ */ jsx("option", { value: "price", children: t(SORT_LABELS.price) }),
                  /* @__PURE__ */ jsx("option", { value: "name", children: t(SORT_LABELS.name) })
                ]
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-1 sm:rounded-full", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onViewModeChange("grid"),
                  className: cn2(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    viewMode === "grid" ? "bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "text-[var(--bokmoo-copy)]"
                  ),
                  type: "button",
                  children: /* @__PURE__ */ jsx(Grid3x3, { className: "h-4 w-4" })
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onViewModeChange("list"),
                  className: cn2(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    viewMode === "list" ? "bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]" : "text-[var(--bokmoo-copy)]"
                  ),
                  type: "button",
                  children: /* @__PURE__ */ jsx(List, { className: "h-4 w-4" })
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", children: [
          /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: CATALOG_FILTERS.map((filter2) => /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setSelectedFilter(filter2),
              className: cn2(
                "rounded-[0.8rem] border px-4 py-2 text-[11px] font-semibold transition-colors",
                selectedFilter === filter2 ? "border-[var(--bokmoo-line-strong)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-[var(--bokmoo-bg)]" : "border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-copy)]"
              ),
              type: "button",
              children: t(FILTER_LABELS[filter2])
            },
            filter2
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
            /* @__PURE__ */ jsxs("span", { className: "rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]", children: [
              displayTotal,
              " ",
              t({ en: "plans", hans: "\u4E2A\u5957\u9910", hant: "\u500B\u5957\u9910" })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "rounded-[0.8rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-2 text-[11px] font-semibold text-[var(--bokmoo-copy)]", children: t({ en: "Instant eSIM delivery", hans: "eSIM \u5373\u65F6\u9001\u8FBE", hant: "eSIM \u5373\u6642\u9001\u9054" }) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "mt-8", children: remoteError && normalizedProducts.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xl font-semibold text-[var(--bokmoo-ink)]", children: t({ en: "Plans are unavailable right now.", hans: "\u5957\u9910\u6682\u65F6\u65E0\u6CD5\u83B7\u53D6\u3002", hant: "\u5957\u9910\u66AB\u6642\u7121\u6CD5\u7372\u53D6\u3002" }) }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--bokmoo-copy)]", children: remoteError }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => void loadRemoteProducts(searchQuery.trim()),
            className: "mt-6 min-h-11 rounded-[0.9rem] bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]",
            type: "button",
            children: t({ en: "Try Again", hans: "\u91CD\u8BD5", hant: "\u91CD\u8A66" })
          }
        )
      ] }) : normalizedProducts.length === 0 ? /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-16 text-center text-[var(--bokmoo-copy)]", children: t({ en: "No plans matched the current search.", hans: "\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u641C\u7D22\u7684\u5957\u9910\u3002", hant: "\u6C92\u6709\u7B26\u5408\u7576\u524D\u641C\u5C0B\u7684\u5957\u9910\u3002" }) }) : /* @__PURE__ */ jsx(
        "div",
        {
          className: cn2(
            "grid gap-3 sm:gap-4",
            viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
          ),
          children: normalizedProducts.map((product) => {
            const profile = getBokmooTravelProfile(product);
            const variantSalePrices = (Array.isArray(product.variants) ? product.variants : []).map((variant) => Number(variant.salePrice ?? variant.price ?? 0)).filter((price) => price > 0);
            const listPrice = Number(product.price || 0);
            const displayPrice = variantSalePrices.length > 0 ? Math.min(listPrice > 0 ? listPrice : Number.POSITIVE_INFINITY, ...variantSalePrices) : listPrice;
            return /* @__PURE__ */ jsxs(
              "article",
              {
                className: cn2(
                  "overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-elevated)_82%,black)] shadow-[var(--bokmoo-shadow)] transition-transform duration-300 hover:-translate-y-1 sm:rounded-[var(--bokmoo-radius-xl)]",
                  viewMode === "list" && "grid gap-4 p-4 md:grid-cols-[14rem_minmax(0,1fr)_12rem] md:items-center md:gap-5 md:p-5"
                ),
                children: [
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => onProductClick(product.id),
                      className: cn2(viewMode === "grid" ? "block text-left" : "contents"),
                      type: "button",
                      children: [
                        /* @__PURE__ */ jsx(
                          "div",
                          {
                            className: cn2(
                              "overflow-hidden border-[var(--bokmoo-line)]",
                              viewMode === "grid" ? "aspect-[1.28/1] border-b sm:aspect-[1.18/1]" : "aspect-[1.45/1] rounded-[1rem] border md:aspect-auto md:h-full md:rounded-[var(--bokmoo-radius-lg)]"
                            ),
                            children: /* @__PURE__ */ jsx(ProductMedia, { product, apiBaseUrl: site.apiBaseUrl })
                          }
                        ),
                        /* @__PURE__ */ jsxs("div", { className: cn2(viewMode === "grid" ? "p-5" : "min-w-0"), children: [
                          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                            /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-gold)]", children: profile.cardEyebrow }),
                            /* @__PURE__ */ jsx("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy)]", children: profile.deliveryLabel })
                          ] }),
                          /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[clamp(1.7rem,2vw,2.4rem)] leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: displayProductTitle(product.name) }),
                          /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: product.description || profile.summary }),
                          /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-2 sm:grid-cols-3", children: [
                            [t({ en: "Coverage", hans: "\u8986\u76D6\u8303\u56F4", hant: "\u8986\u84CB\u7BC4\u570D" }), profile.coverageLabel],
                            [t({ en: "Plan", hans: "\u5957\u9910", hant: "\u5957\u9910" }), profile.planLabel],
                            [t({ en: "Validity", hans: "\u6709\u6548\u671F", hant: "\u6709\u6548\u671F" }), profile.durationLabel]
                          ].map(([label, value]) => /* @__PURE__ */ jsxs(
                            "div",
                            {
                              className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-3 py-3",
                              children: [
                                /* @__PURE__ */ jsx("p", { className: "text-[10px] tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: label }),
                                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm font-medium text-[var(--bokmoo-ink)]", children: value })
                              ]
                            },
                            label
                          )) })
                        ] })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: cn2(viewMode === "grid" ? "px-5 pb-5" : "md:w-[12rem]"), children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_90%,black)] p-4", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: t({ en: "Starting at", hans: "\u8D77\u4EF7", hant: "\u8D77\u50F9" }) }),
                    /* @__PURE__ */ jsxs("p", { className: "mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                      "$",
                      Number(Number.isFinite(displayPrice) ? displayPrice : 0).toFixed(2)
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-copy)]", children: profile.planBadge }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: () => onAddToCart(product.id),
                        className: "mt-4 w-full rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
                        type: "button",
                        children: t({ en: "Buy Now", hans: "\u7ACB\u5373\u8D2D\u4E70", hant: "\u7ACB\u5373\u8CFC\u8CB7" })
                      }
                    )
                  ] }) })
                ]
              },
              product.id
            );
          })
        }
      ) }),
      displayTotalPages > 1 ? /* @__PURE__ */ jsxs("nav", { className: "mt-10 flex items-center justify-center gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.max(1, currentPage - 1)),
            disabled: currentPage <= 1,
            className: "flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40",
            type: "button",
            children: /* @__PURE__ */ jsx(ChevronLeft, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]", children: [
          t({ en: "Page", hans: "\u7B2C", hant: "\u7B2C" }),
          " ",
          currentPage,
          " / ",
          displayTotalPages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.min(displayTotalPages, currentPage + 1)),
            disabled: currentPage >= displayTotalPages,
            className: "flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] text-[var(--bokmoo-ink)] disabled:opacity-40",
            type: "button",
            children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4" })
          }
        )
      ] }) : null
    ] }) });
  });

  // src/components/CollectionPages.tsx
  var BestsellersPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      ...props,
      totalProducts: props.totalProducts ?? props.products?.length ?? 0,
      currentPage: props.currentPage ?? 1,
      totalPages: props.totalPages ?? 1,
      viewMode: "grid",
      onViewModeChange: () => void 0,
      onSearch: () => void 0
    }
  );
  var NewArrivalsPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      ...props,
      totalProducts: props.totalProducts ?? props.products?.length ?? 0,
      currentPage: props.currentPage ?? 1,
      totalPages: props.totalPages ?? 1,
      viewMode: "grid",
      onViewModeChange: () => void 0,
      onSearch: () => void 0
    }
  );
  var DealsPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      products: props.products,
      isLoading: props.isLoading,
      totalProducts: props.products?.length ?? 0,
      currentPage: 1,
      totalPages: 1,
      sortBy: "createdAt",
      viewMode: "grid",
      config: props.config,
      locale: props.locale,
      t: props.t,
      onSortChange: () => void 0,
      onViewModeChange: () => void 0,
      onPageChange: () => void 0,
      onAddToCart: props.onAddToCart,
      onProductClick: props.onProductClick,
      onSearch: () => void 0
    }
  );
  var SearchPage = (props) => /* @__PURE__ */ jsx(
    ProductsPage,
    {
      products: props.products,
      isLoading: props.isLoading,
      totalProducts: props.products?.length ?? 0,
      currentPage: 1,
      totalPages: 1,
      sortBy: props.sortBy,
      viewMode: props.viewMode,
      config: props.config,
      locale: props.locale,
      t: props.t,
      onSortChange: props.onSortChange,
      onViewModeChange: props.onViewModeChange,
      onPageChange: () => void 0,
      onAddToCart: props.onAddToCart,
      onProductClick: props.onProductClick,
      onSearch: () => void 0
    }
  );

  // src/components/ContactPage.tsx
  var ContactPage = react_default.memo(function ContactPage2({ config, locale }) {
    const t = (copy) => pickCopy(locale, copy);
    const site = resolveBokmooSiteConfig(config);
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[980px]", children: /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] shadow-[var(--bokmoo-shadow)] sm:rounded-[1.6rem]", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: t({ en: "About BOKMOO", hans: "\u5173\u4E8E BOKMOO", hant: "\u95DC\u65BC BOKMOO" }) }),
        /* @__PURE__ */ jsx("h1", { className: "mt-4 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "BOKMOO is built for global travelers.", hans: "BOKMOO \u4E3A\u5168\u7403\u65C5\u884C\u8005\u800C\u751F\u3002", hant: "BOKMOO \u70BA\u5168\u7403\u65C5\u884C\u8005\u800C\u751F\u3002" }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-5 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]", children: t({ en: "Our mission is to make connectivity simple, affordable, and reliable anywhere in the world.", hans: "\u6211\u4EEC\u7684\u4F7F\u547D\u662F\u8BA9\u5168\u7403\u8FDE\u63A5\u53D8\u5F97\u7B80\u5355\u3001\u5B9E\u60E0\u3001\u53EF\u9760\u3002", hant: "\u6211\u5011\u7684\u4F7F\u547D\u662F\u8B93\u5168\u7403\u9023\u63A5\u8B8A\u5F97\u7C21\u55AE\u3001\u5BE6\u60E0\u3001\u53EF\u9760\u3002" }) }),
        /* @__PURE__ */ jsx(
          "a",
          {
            href: `mailto:${site.supportEmail}`,
            className: "mt-6 inline-flex min-h-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-5 text-sm font-medium text-[var(--bokmoo-ink)]",
            children: site.supportEmail
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "mt-8 grid gap-4 sm:grid-cols-3", children: [
          ["200+", t({ en: "Countries", hans: "\u56FD\u5BB6\u548C\u5730\u533A", hant: "\u570B\u5BB6\u548C\u5730\u5340" })],
          ["1M+", t({ en: "Happy Users", hans: "\u6EE1\u610F\u7528\u6237", hant: "\u6EFF\u610F\u7528\u6236" })],
          ["99.9%", t({ en: "Uptime", hans: "\u5728\u7EBF\u7387", hant: "\u5728\u7DDA\u7387" })]
        ].map(([value, label]) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-5",
            children: [
              /* @__PURE__ */ jsx("p", { className: "text-3xl font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]", children: value }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[var(--bokmoo-copy-soft)]", children: label })
            ]
          },
          label
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative min-h-[15rem] overflow-hidden rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(160deg,#30261c_0%,#141210_56%,#0a0a0b_100%)] sm:min-h-[19rem] sm:rounded-[1.4rem]", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(215,178,61,0.34),transparent_26%)]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)]" })
      ] })
    ] }) }) }) });
  });

  // src/components/DownloadAppPage.tsx
  var ANDROID_PLAY_URL = "https://play.google.com/store/apps/details?id=com.bokmoo.app";
  var ANDROID_APK_URL = "https://bokmoo.com/extensions/downloads/bokmoo-0.0.6-vc14.apk";
  var ANDROID_APK_VERSION = "0.0.6 (14)";
  var ANDROID_APK_SIZE = "79 MB";
  var IOS_APP_STORE_QR_PATH = "M0,0H1V1H0zM1,0H2V1H1zM2,0H3V1H2zM3,0H4V1H3zM4,0H5V1H4zM5,0H6V1H5zM6,0H7V1H6zM9,0H10V1H9zM10,0H11V1H10zM11,0H12V1H11zM14,0H15V1H14zM17,0H18V1H17zM18,0H19V1H18zM19,0H20V1H19zM22,0H23V1H22zM23,0H24V1H23zM24,0H25V1H24zM25,0H26V1H25zM26,0H27V1H26zM27,0H28V1H27zM28,0H29V1H28zM0,1H1V2H0zM6,1H7V2H6zM10,1H11V2H10zM11,1H12V2H11zM13,1H14V2H13zM15,1H16V2H15zM16,1H17V2H16zM17,1H18V2H17zM20,1H21V2H20zM22,1H23V2H22zM28,1H29V2H28zM0,2H1V3H0zM2,2H3V3H2zM3,2H4V3H3zM4,2H5V3H4zM6,2H7V3H6zM8,2H9V3H8zM9,2H10V3H9zM11,2H12V3H11zM15,2H16V3H15zM16,2H17V3H16zM20,2H21V3H20zM22,2H23V3H22zM24,2H25V3H24zM25,2H26V3H25zM26,2H27V3H26zM28,2H29V3H28zM0,3H1V4H0zM2,3H3V4H2zM3,3H4V4H3zM4,3H5V4H4zM6,3H7V4H6zM8,3H9V4H8zM9,3H10V4H9zM11,3H12V4H11zM12,3H13V4H12zM13,3H14V4H13zM15,3H16V4H15zM16,3H17V4H16zM17,3H18V4H17zM19,3H20V4H19zM22,3H23V4H22zM24,3H25V4H24zM25,3H26V4H25zM26,3H27V4H26zM28,3H29V4H28zM0,4H1V5H0zM2,4H3V5H2zM3,4H4V5H3zM4,4H5V5H4zM6,4H7V5H6zM8,4H9V5H8zM11,4H12V5H11zM14,4H15V5H14zM18,4H19V5H18zM19,4H20V5H19zM20,4H21V5H20zM22,4H23V5H22zM24,4H25V5H24zM25,4H26V5H25zM26,4H27V5H26zM28,4H29V5H28zM0,5H1V6H0zM6,5H7V6H6zM8,5H9V6H8zM9,5H10V6H9zM10,5H11V6H10zM11,5H12V6H11zM12,5H13V6H12zM13,5H14V6H13zM14,5H15V6H14zM15,5H16V6H15zM16,5H17V6H16zM18,5H19V6H18zM20,5H21V6H20zM22,5H23V6H22zM28,5H29V6H28zM0,6H1V7H0zM1,6H2V7H1zM2,6H3V7H2zM3,6H4V7H3zM4,6H5V7H4zM5,6H6V7H5zM6,6H7V7H6zM8,6H9V7H8zM10,6H11V7H10zM12,6H13V7H12zM14,6H15V7H14zM16,6H17V7H16zM18,6H19V7H18zM20,6H21V7H20zM22,6H23V7H22zM23,6H24V7H23zM24,6H25V7H24zM25,6H26V7H25zM26,6H27V7H26zM27,6H28V7H27zM28,6H29V7H28zM8,7H9V8H8zM11,7H12V8H11zM15,7H16V8H15zM16,7H17V8H16zM19,7H20V8H19zM20,7H21V8H20zM0,8H1V9H0zM2,8H3V9H2zM3,8H4V9H3zM4,8H5V9H4zM5,8H6V9H5zM6,8H7V9H6zM12,8H13V9H12zM13,8H14V9H13zM15,8H16V9H15zM16,8H17V9H16zM17,8H18V9H17zM19,8H20V9H19zM22,8H23V9H22zM23,8H24V9H23zM24,8H25V9H24zM25,8H26V9H25zM26,8H27V9H26zM2,9H3V10H2zM3,9H4V10H3zM5,9H6V10H5zM8,9H9V10H8zM9,9H10V10H9zM10,9H11V10H10zM14,9H15V10H14zM19,9H20V10H19zM20,9H21V10H20zM21,9H22V10H21zM22,9H23V10H22zM24,9H25V10H24zM28,9H29V10H28zM1,10H2V11H1zM2,10H3V11H2zM4,10H5V11H4zM5,10H6V11H5zM6,10H7V11H6zM7,10H8V11H7zM9,10H10V11H9zM11,10H12V11H11zM12,10H13V11H12zM14,10H15V11H14zM15,10H16V11H15zM18,10H19V11H18zM20,10H21V11H20zM22,10H23V11H22zM23,10H24V11H23zM0,11H1V12H0zM1,11H2V12H1zM2,11H3V12H2zM3,11H4V12H3zM5,11H6V12H5zM7,11H8V12H7zM8,11H9V12H8zM10,11H11V12H10zM14,11H15V12H14zM15,11H16V12H15zM16,11H17V12H16zM18,11H19V12H18zM19,11H20V12H19zM21,11H22V12H21zM22,11H23V12H22zM24,11H25V12H24zM25,11H26V12H25zM27,11H28V12H27zM1,12H2V13H1zM2,12H3V13H2zM4,12H5V13H4zM5,12H6V13H5zM6,12H7V13H6zM7,12H8V13H7zM11,12H12V13H11zM12,12H13V13H12zM15,12H16V13H15zM16,12H17V13H16zM17,12H18V13H17zM23,12H24V13H23zM25,12H26V13H25zM26,12H27V13H26zM1,13H2V14H1zM2,13H3V14H2zM8,13H9V14H8zM9,13H10V14H9zM10,13H11V14H10zM12,13H13V14H12zM13,13H14V14H13zM19,13H20V14H19zM20,13H21V14H20zM21,13H22V14H21zM22,13H23V14H22zM23,13H24V14H23zM24,13H25V14H24zM28,13H29V14H28zM6,14H7V15H6zM7,14H8V15H7zM10,14H11V15H10zM13,14H14V15H13zM14,14H15V15H14zM15,14H16V15H15zM16,14H17V15H16zM18,14H19V15H18zM21,14H22V15H21zM24,14H25V15H24zM25,14H26V15H25zM26,14H27V15H26zM0,15H1V16H0zM1,15H2V16H1zM2,15H3V16H2zM3,15H4V16H3zM5,15H6V16H5zM8,15H9V16H8zM10,15H11V16H10zM11,15H12V16H11zM13,15H14V16H13zM15,15H16V16H15zM18,15H19V16H18zM19,15H20V16H19zM20,15H21V16H20zM24,15H25V16H24zM27,15H28V16H27zM5,16H6V17H5zM6,16H7V17H6zM7,16H8V17H7zM9,16H10V17H9zM10,16H11V17H10zM12,16H13V17H12zM14,16H15V17H14zM15,16H16V17H15zM16,16H17V17H16zM17,16H18V17H17zM18,16H19V17H18zM19,16H20V17H19zM23,16H24V17H23zM25,16H26V17H25zM26,16H27V17H26zM0,17H1V18H0zM5,17H6V18H5zM9,17H10V18H9zM10,17H11V18H10zM12,17H13V18H12zM17,17H18V18H17zM18,17H19V18H18zM19,17H20V18H19zM22,17H23V18H22zM23,17H24V18H23zM24,17H25V18H24zM26,17H27V18H26zM28,17H29V18H28zM0,18H1V19H0zM3,18H4V19H3zM5,18H6V19H5zM6,18H7V19H6zM8,18H9V19H8zM9,18H10V19H9zM15,18H16V19H15zM16,18H17V19H16zM17,18H18V19H17zM20,18H21V19H20zM21,18H22V19H21zM24,18H25V19H24zM26,18H27V19H26zM0,19H1V20H0zM2,19H3V20H2zM3,19H4V20H3zM4,19H5V20H4zM5,19H6V20H5zM7,19H8V20H7zM9,19H10V20H9zM14,19H15V20H14zM15,19H16V20H15zM20,19H21V20H20zM21,19H22V20H21zM24,19H25V20H24zM27,19H28V20H27zM0,20H1V21H0zM2,20H3V21H2zM4,20H5V21H4zM5,20H6V21H5zM6,20H7V21H6zM7,20H8V21H7zM8,20H9V21H8zM9,20H10V21H9zM10,20H11V21H10zM12,20H13V21H12zM16,20H17V21H16zM17,20H18V21H17zM20,20H21V21H20zM21,20H22V21H21zM22,20H23V21H22zM23,20H24V21H23zM24,20H25V21H24zM26,20H27V21H26zM27,20H28V21H27zM28,20H29V21H28zM8,21H9V22H8zM9,21H10V22H9zM10,21H11V22H10zM11,21H12V22H11zM13,21H14V22H13zM14,21H15V22H14zM17,21H18V22H17zM18,21H19V22H18zM20,21H21V22H20zM24,21H25V22H24zM25,21H26V22H25zM26,21H27V22H26zM27,21H28V22H27zM28,21H29V22H28zM0,22H1V23H0zM1,22H2V23H1zM2,22H3V23H2zM3,22H4V23H3zM4,22H5V23H4zM5,22H6V23H5zM6,22H7V23H6zM11,22H12V23H11zM13,22H14V23H13zM14,22H15V23H14zM15,22H16V23H15zM16,22H17V23H16zM18,22H19V23H18zM19,22H20V23H19zM20,22H21V23H20zM22,22H23V23H22zM24,22H25V23H24zM25,22H26V23H25zM26,22H27V23H26zM0,23H1V24H0zM6,23H7V24H6zM8,23H9V24H8zM11,23H12V24H11zM13,23H14V24H13zM16,23H17V24H16zM19,23H20V24H19zM20,23H21V24H20zM24,23H25V24H24zM28,23H29V24H28zM0,24H1V25H0zM2,24H3V25H2zM3,24H4V25H3zM4,24H5V25H4zM6,24H7V25H6zM8,24H9V25H8zM9,24H10V25H9zM10,24H11V25H10zM11,24H12V25H11zM12,24H13V25H12zM14,24H15V25H14zM15,24H16V25H15zM16,24H17V25H16zM17,24H18V25H17zM20,24H21V25H20zM21,24H22V25H21zM22,24H23V25H22zM23,24H24V25H23zM24,24H25V25H24zM26,24H27V25H26zM0,25H1V26H0zM2,25H3V26H2zM3,25H4V26H3zM4,25H5V26H4zM6,25H7V26H6zM8,25H9V26H8zM9,25H10V26H9zM18,25H19V26H18zM23,25H24V26H23zM25,25H26V26H25zM26,25H27V26H26zM27,25H28V26H27zM28,25H29V26H28zM0,26H1V27H0zM2,26H3V27H2zM3,26H4V27H3zM4,26H5V27H4zM6,26H7V27H6zM8,26H9V27H8zM9,26H10V27H9zM10,26H11V27H10zM14,26H15V27H14zM15,26H16V27H15zM19,26H20V27H19zM20,26H21V27H20zM22,26H23V27H22zM23,26H24V27H23zM24,26H25V27H24zM25,26H26V27H25zM26,26H27V27H26zM27,26H28V27H27zM0,27H1V28H0zM6,27H7V28H6zM10,27H11V28H10zM11,27H12V28H11zM12,27H13V28H12zM13,27H14V28H13zM16,27H17V28H16zM18,27H19V28H18zM20,27H21V28H20zM21,27H22V28H21zM23,27H24V28H23zM24,27H25V28H24zM25,27H26V28H25zM27,27H28V28H27zM0,28H1V29H0zM1,28H2V29H1zM2,28H3V29H2zM3,28H4V29H3zM4,28H5V29H4zM5,28H6V29H5zM6,28H7V29H6zM8,28H9V29H8zM15,28H16V29H15zM16,28H17V29H16zM17,28H18V29H17zM18,28H19V29H18zM19,28H20V29H19zM21,28H22V29H21zM24,28H25V29H24zM26,28H27V29H26z";
  var ANDROID_PLAY_QR_PATH = "M0,0H1V1H0zM1,0H2V1H1zM2,0H3V1H2zM3,0H4V1H3zM4,0H5V1H4zM5,0H6V1H5zM6,0H7V1H6zM8,0H9V1H8zM11,0H12V1H11zM13,0H14V1H13zM17,0H18V1H17zM18,0H19V1H18zM19,0H20V1H19zM20,0H21V1H20zM21,0H22V1H21zM23,0H24V1H23zM26,0H27V1H26zM27,0H28V1H27zM28,0H29V1H28zM29,0H30V1H29zM30,0H31V1H30zM31,0H32V1H31zM32,0H33V1H32zM0,1H1V2H0zM6,1H7V2H6zM8,1H9V2H8zM11,1H12V2H11zM13,1H14V2H13zM16,1H17V2H16zM22,1H23V2H22zM23,1H24V2H23zM26,1H27V2H26zM32,1H33V2H32zM0,2H1V3H0zM2,2H3V3H2zM3,2H4V3H3zM4,2H5V3H4zM6,2H7V3H6zM10,2H11V3H10zM12,2H13V3H12zM18,2H19V3H18zM22,2H23V3H22zM23,2H24V3H23zM24,2H25V3H24zM26,2H27V3H26zM28,2H29V3H28zM29,2H30V3H29zM30,2H31V3H30zM32,2H33V3H32zM0,3H1V4H0zM2,3H3V4H2zM3,3H4V4H3zM4,3H5V4H4zM6,3H7V4H6zM8,3H9V4H8zM9,3H10V4H9zM10,3H11V4H10zM12,3H13V4H12zM14,3H15V4H14zM15,3H16V4H15zM17,3H18V4H17zM23,3H24V4H23zM24,3H25V4H24zM26,3H27V4H26zM28,3H29V4H28zM29,3H30V4H29zM30,3H31V4H30zM32,3H33V4H32zM0,4H1V5H0zM2,4H3V5H2zM3,4H4V5H3zM4,4H5V5H4zM6,4H7V5H6zM9,4H10V5H9zM13,4H14V5H13zM14,4H15V5H14zM19,4H20V5H19zM22,4H23V5H22zM24,4H25V5H24zM26,4H27V5H26zM28,4H29V5H28zM29,4H30V5H29zM30,4H31V5H30zM32,4H33V5H32zM0,5H1V6H0zM6,5H7V6H6zM9,5H10V6H9zM10,5H11V6H10zM12,5H13V6H12zM14,5H15V6H14zM16,5H17V6H16zM17,5H18V6H17zM18,5H19V6H18zM19,5H20V6H19zM20,5H21V6H20zM21,5H22V6H21zM24,5H25V6H24zM26,5H27V6H26zM32,5H33V6H32zM0,6H1V7H0zM1,6H2V7H1zM2,6H3V7H2zM3,6H4V7H3zM4,6H5V7H4zM5,6H6V7H5zM6,6H7V7H6zM8,6H9V7H8zM10,6H11V7H10zM12,6H13V7H12zM14,6H15V7H14zM16,6H17V7H16zM18,6H19V7H18zM20,6H21V7H20zM22,6H23V7H22zM24,6H25V7H24zM26,6H27V7H26zM27,6H28V7H27zM28,6H29V7H28zM29,6H30V7H29zM30,6H31V7H30zM31,6H32V7H31zM32,6H33V7H32zM8,7H9V8H8zM17,7H18V8H17zM18,7H19V8H18zM19,7H20V8H19zM22,7H23V8H22zM23,7H24V8H23zM0,8H1V9H0zM2,8H3V9H2zM3,8H4V9H3zM5,8H6V9H5zM6,8H7V9H6zM7,8H8V9H7zM10,8H11V9H10zM11,8H12V9H11zM14,8H15V9H14zM16,8H17V9H16zM17,8H18V9H17zM18,8H19V9H18zM21,8H22V9H21zM23,8H24V9H23zM26,8H27V9H26zM29,8H30V9H29zM31,8H32V9H31zM32,8H33V9H32zM0,9H1V10H0zM1,9H2V10H1zM3,9H4V10H3zM4,9H5V10H4zM5,9H6V10H5zM7,9H8V10H7zM8,9H9V10H8zM9,9H10V10H9zM10,9H11V10H10zM12,9H13V10H12zM16,9H17V10H16zM17,9H18V10H17zM18,9H19V10H18zM19,9H20V10H19zM20,9H21V10H20zM23,9H24V10H23zM24,9H25V10H24zM26,9H27V10H26zM27,9H28V10H27zM29,9H30V10H29zM30,9H31V10H30zM31,9H32V10H31zM32,9H33V10H32zM1,10H2V11H1zM2,10H3V11H2zM6,10H7V11H6zM7,10H8V11H7zM10,10H11V11H10zM12,10H13V11H12zM14,10H15V11H14zM17,10H18V11H17zM18,10H19V11H18zM20,10H21V11H20zM22,10H23V11H22zM23,10H24V11H23zM24,10H25V11H24zM26,10H27V11H26zM27,10H28V11H27zM28,10H29V11H28zM29,10H30V11H29zM31,10H32V11H31zM32,10H33V11H32zM1,11H2V12H1zM2,11H3V12H2zM4,11H5V12H4zM9,11H10V12H9zM10,11H11V12H10zM12,11H13V12H12zM13,11H14V12H13zM14,11H15V12H14zM15,11H16V12H15zM16,11H17V12H16zM18,11H19V12H18zM20,11H21V12H20zM27,11H28V12H27zM29,11H30V12H29zM31,11H32V12H31zM0,12H1V13H0zM1,12H2V13H1zM2,12H3V13H2zM3,12H4V13H3zM6,12H7V13H6zM8,12H9V13H8zM10,12H11V13H10zM11,12H12V13H11zM12,12H13V13H12zM15,12H16V13H15zM16,12H17V13H16zM17,12H18V13H17zM19,12H20V13H19zM22,12H23V13H22zM23,12H24V13H23zM24,12H25V13H24zM25,12H26V13H25zM27,12H28V13H27zM28,12H29V13H28zM29,12H30V13H29zM1,13H2V14H1zM4,13H5V14H4zM10,13H11V14H10zM13,13H14V14H13zM15,13H16V14H15zM16,13H17V14H16zM19,13H20V14H19zM21,13H22V14H21zM24,13H25V14H24zM27,13H28V14H27zM29,13H30V14H29zM31,13H32V14H31zM3,14H4V15H3zM4,14H5V15H4zM6,14H7V15H6zM7,14H8V15H7zM11,14H12V15H11zM14,14H15V15H14zM16,14H17V15H16zM18,14H19V15H18zM19,14H20V15H19zM21,14H22V15H21zM24,14H25V15H24zM26,14H27V15H26zM28,14H29V15H28zM29,14H30V15H29zM30,14H31V15H30zM1,15H2V16H1zM3,15H4V16H3zM7,15H8V16H7zM8,15H9V16H8zM9,15H10V16H9zM14,15H15V16H14zM15,15H16V16H15zM19,15H20V16H19zM21,15H22V16H21zM22,15H23V16H22zM23,15H24V16H23zM25,15H26V16H25zM26,15H27V16H26zM30,15H31V16H30zM5,16H6V17H5zM6,16H7V17H6zM8,16H9V17H8zM9,16H10V17H9zM13,16H14V17H13zM16,16H17V17H16zM20,16H21V17H20zM21,16H22V17H21zM22,16H23V17H22zM24,16H25V17H24zM25,16H26V17H25zM26,16H27V17H26zM28,16H29V17H28zM29,16H30V17H29zM30,16H31V17H30zM2,17H3V18H2zM5,17H6V18H5zM7,17H8V18H7zM8,17H9V18H8zM10,17H11V18H10zM12,17H13V18H12zM14,17H15V18H14zM15,17H16V18H15zM17,17H18V18H17zM22,17H23V18H22zM23,17H24V18H23zM24,17H25V18H24zM26,17H27V18H26zM28,17H29V18H28zM29,17H30V18H29zM32,17H33V18H32zM0,18H1V19H0zM1,18H2V19H1zM2,18H3V19H2zM3,18H4V19H3zM4,18H5V19H4zM6,18H7V19H6zM8,18H9V19H8zM9,18H10V19H9zM12,18H13V19H12zM13,18H14V19H13zM15,18H16V19H15zM16,18H17V19H16zM17,18H18V19H17zM20,18H21V19H20zM26,18H27V19H26zM27,18H28V19H27zM28,18H29V19H28zM30,18H31V19H30zM31,18H32V19H31zM2,19H3V20H2zM8,19H9V20H8zM13,19H14V20H13zM15,19H16V20H15zM16,19H17V20H16zM17,19H18V20H17zM18,19H19V20H18zM22,19H23V20H22zM23,19H24V20H23zM25,19H26V20H25zM26,19H27V20H26zM28,19H29V20H28zM32,19H33V20H32zM0,20H1V21H0zM1,20H2V21H1zM2,20H3V21H2zM3,20H4V21H3zM6,20H7V21H6zM7,20H8V21H7zM9,20H10V21H9zM13,20H14V21H13zM14,20H15V21H14zM15,20H16V21H15zM17,20H18V21H17zM18,20H19V21H18zM19,20H20V21H19zM21,20H22V21H21zM24,20H25V21H24zM27,20H28V21H27zM29,20H30V21H29zM30,20H31V21H30zM31,20H32V21H31zM0,21H1V22H0zM1,21H2V22H1zM2,21H3V22H2zM8,21H9V22H8zM9,21H10V22H9zM11,21H12V22H11zM12,21H13V22H12zM14,21H15V22H14zM16,21H17V22H16zM17,21H18V22H17zM18,21H19V22H18zM19,21H20V22H19zM20,21H21V22H20zM23,21H24V22H23zM24,21H25V22H24zM26,21H27V22H26zM29,21H30V22H29zM32,21H33V22H32zM2,22H3V23H2zM3,22H4V23H3zM5,22H6V23H5zM6,22H7V23H6zM7,22H8V23H7zM9,22H10V23H9zM10,22H11V23H10zM14,22H15V23H14zM16,22H17V23H16zM18,22H19V23H18zM20,22H21V23H20zM21,22H22V23H21zM22,22H23V23H22zM23,22H24V23H23zM24,22H25V23H24zM26,22H27V23H26zM27,22H28V23H27zM30,22H31V23H30zM31,22H32V23H31zM32,22H33V23H32zM1,23H2V24H1zM2,23H3V24H2zM4,23H5V24H4zM7,23H8V24H7zM9,23H10V24H9zM10,23H11V24H10zM11,23H12V24H11zM13,23H14V24H13zM16,23H17V24H16zM18,23H19V24H18zM20,23H21V24H20zM23,23H24V24H23zM25,23H26V24H25zM27,23H28V24H27zM28,23H29V24H28zM29,23H30V24H29zM31,23H32V24H31zM0,24H1V25H0zM3,24H4V25H3zM6,24H7V25H6zM7,24H8V25H7zM9,24H10V25H9zM10,24H11V25H10zM15,24H16V25H15zM17,24H18V25H17zM19,24H20V25H19zM22,24H23V25H22zM24,24H25V25H24zM25,24H26V25H25zM26,24H27V25H26zM27,24H28V25H27zM28,24H29V25H28zM31,24H32V25H31zM32,24H33V25H32zM8,25H9V26H8zM11,25H12V26H11zM12,25H13V26H12zM15,25H16V26H15zM16,25H17V26H16zM18,25H19V26H18zM19,25H20V26H19zM21,25H22V26H21zM23,25H24V26H23zM24,25H25V26H24zM28,25H29V26H28zM29,25H30V26H29zM31,25H32V26H31zM0,26H1V27H0zM1,26H2V27H1zM2,26H3V27H2zM3,26H4V27H3zM4,26H5V27H4zM5,26H6V27H5zM6,26H7V27H6zM8,26H9V27H8zM10,26H11V27H10zM11,26H12V27H11zM13,26H14V27H13zM16,26H17V27H16zM17,26H18V27H17zM18,26H19V27H18zM19,26H20V27H19zM21,26H22V27H21zM23,26H24V27H23zM24,26H25V27H24zM26,26H27V27H26zM28,26H29V27H28zM0,27H1V28H0zM6,27H7V28H6zM8,27H9V28H8zM9,27H10V28H9zM14,27H15V28H14zM15,27H16V28H15zM16,27H17V28H16zM20,27H21V28H20zM21,27H22V28H21zM22,27H23V28H22zM23,27H24V28H23zM24,27H25V28H24zM28,27H29V28H28zM29,27H30V28H29zM30,27H31V28H30zM31,27H32V28H31zM0,28H1V29H0zM2,28H3V29H2zM3,28H4V29H3zM4,28H5V29H4zM6,28H7V29H6zM9,28H10V29H9zM10,28H11V29H10zM11,28H12V29H11zM13,28H14V29H13zM19,28H20V29H19zM20,28H21V29H20zM21,28H22V29H21zM22,28H23V29H22zM23,28H24V29H23zM24,28H25V29H24zM25,28H26V29H25zM26,28H27V29H26zM27,28H28V29H27zM28,28H29V29H28zM30,28H31V29H30zM32,28H33V29H32zM0,29H1V30H0zM2,29H3V30H2zM3,29H4V30H3zM4,29H5V30H4zM6,29H7V30H6zM8,29H9V30H8zM10,29H11V30H10zM12,29H13V30H12zM14,29H15V30H14zM15,29H16V30H15zM22,29H23V30H22zM27,29H28V30H27zM29,29H30V30H29zM32,29H33V30H32zM0,30H1V31H0zM2,30H3V31H2zM3,30H4V31H3zM4,30H5V31H4zM6,30H7V31H6zM8,30H9V31H8zM9,30H10V31H9zM13,30H14V31H13zM14,30H15V31H14zM15,30H16V31H15zM17,30H18V31H17zM18,30H19V31H18zM20,30H21V31H20zM22,30H23V31H22zM23,30H24V31H23zM26,30H27V31H26zM27,30H28V31H27zM30,30H31V31H30zM0,31H1V32H0zM6,31H7V32H6zM11,31H12V32H11zM12,31H13V32H12zM15,31H16V32H15zM16,31H17V32H16zM17,31H18V32H17zM18,31H19V32H18zM22,31H23V32H22zM24,31H25V32H24zM25,31H26V32H25zM27,31H28V32H27zM28,31H29V32H28zM32,31H33V32H32zM0,32H1V33H0zM1,32H2V33H1zM2,32H3V33H2zM3,32H4V33H3zM4,32H5V33H4zM5,32H6V33H5zM6,32H7V33H6zM8,32H9V33H8zM12,32H13V33H12zM15,32H16V33H15zM17,32H18V33H17zM18,32H19V33H18zM21,32H22V33H21zM23,32H24V33H23zM25,32H26V33H25zM28,32H29V33H28zM30,32H31V33H30z";
  function AppleIcon() {
    return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "h-5 w-5", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" }) });
  }
  function AndroidIcon() {
    return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "h-5 w-5", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.46 11.46 0 00-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48A10.81 10.81 0 001 18h22a10.81 10.81 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" }) });
  }
  function QrPopover({ pathData, modules, label }) {
    return /* @__PURE__ */ jsxs(
      "div",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute left-1/2 top-full z-20 hidden -translate-x-1/2 translate-y-1 flex-col items-center pt-3 opacity-0 transition-all duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 lg:flex",
        children: [
          /* @__PURE__ */ jsx("div", { className: "h-3 w-3 rotate-45 rounded-[2px] bg-white" }),
          /* @__PURE__ */ jsx("div", { className: "-mt-1.5 rounded-[0.9rem] bg-white p-3 shadow-[0_16px_48px_rgba(0,0,0,0.5)]", children: /* @__PURE__ */ jsx("svg", { viewBox: `0 0 ${modules} ${modules}`, width: 120, height: 120, className: "h-[7.5rem] w-[7.5rem]", shapeRendering: "crispEdges", role: "img", "aria-label": label, children: /* @__PURE__ */ jsx("path", { d: pathData, fill: "#14120e" }) }) }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-[var(--bokmoo-copy-soft)]", children: label })
        ]
      }
    );
  }
  var DownloadAppPage = react_default.memo(function DownloadAppPage2({ config, locale }) {
    const site = resolveBokmooSiteConfig(config, locale);
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px]", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: "BOKMOO App" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-4 text-[clamp(2.2rem,4vw,3.4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Your BOKMOO card, in your pocket.", hans: "\u60A8\u7684 BOKMOO \u5361\uFF0C\u5C3D\u5728\u638C\u4E2D\u3002", hant: "\u60A8\u7684 BOKMOO \u5361\uFF0C\u76E1\u5728\u638C\u4E2D\u3002" }) }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-5 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]", children: pickCopy(locale, {
          en: "Activate your BOKMOO card over Bluetooth, install and switch eSIM profiles, and track your data \u2014 right from your phone.",
          hans: "\u901A\u8FC7\u84DD\u7259\u6FC0\u6D3B\u60A8\u7684 BOKMOO \u5361\uFF0C\u5B89\u88C5\u548C\u5207\u6362 eSIM \u914D\u7F6E\u6587\u4EF6\uFF0C\u968F\u65F6\u638C\u63E1\u6570\u636E\u2014\u2014\u5C31\u5728\u60A8\u7684\u624B\u673A\u4E0A\u3002",
          hant: "\u900F\u904E\u85CD\u7259\u555F\u7528\u60A8\u7684 BOKMOO \u5361\uFF0C\u5B89\u88DD\u548C\u5207\u63DB eSIM \u8A2D\u5B9A\u6A94\uFF0C\u96A8\u6642\u638C\u63E1\u6578\u64DA\u2014\u2014\u5C31\u5728\u60A8\u7684\u624B\u6A5F\u4E0A\u3002"
        }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-3 hidden text-xs text-[var(--bokmoo-copy-soft)] lg:block", children: "Hover a store button (or scan the card QR) to download." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-10 grid gap-5 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("span", { className: "inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(AppleIcon, {}) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-lg font-semibold tracking-[-0.03em] text-[var(--bokmoo-ink)]", children: "iOS" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--bokmoo-copy-soft)]", children: "iPhone \xB7 iPad" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-5 text-sm leading-7 text-[var(--bokmoo-copy)]", children: pickCopy(locale, { en: "Requires iOS 15 or later. Activates BOKMOO cards over Bluetooth.", hans: "\u9700\u8981 iOS 15 \u6216\u66F4\u9AD8\u7248\u672C\u3002\u901A\u8FC7\u84DD\u7259\u6FC0\u6D3B BOKMOO \u5361\u3002", hant: "\u9700\u8981 iOS 15 \u6216\u66F4\u65B0\u7248\u672C\u3002\u900F\u904E\u85CD\u7259\u555F\u7528 BOKMOO \u5361\u3002" }) }),
          /* @__PURE__ */ jsxs("div", { className: "group relative mt-6", children: [
            /* @__PURE__ */ jsxs(
              "a",
              {
                href: "https://apps.apple.com/app/id6791455265",
                target: "_blank",
                rel: "noopener noreferrer",
                className: "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-sm font-semibold text-[var(--bokmoo-bg)]",
                children: [
                  /* @__PURE__ */ jsx(AppleIcon, {}),
                  pickCopy(locale, { en: "Download on the App Store", hans: "\u5728 App Store \u4E0B\u8F7D", hant: "\u5728 App Store \u4E0B\u8F09" })
                ]
              }
            ),
            /* @__PURE__ */ jsx(QrPopover, { pathData: IOS_APP_STORE_QR_PATH, modules: 29, label: pickCopy(locale, { en: "Scan with iPhone", hans: "\u626B\u7801\u4E0B\u8F7D iOS \u7248", hant: "\u6383\u78BC\u4E0B\u8F09 iOS \u7248" }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("span", { className: "inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(AndroidIcon, {}) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-lg font-semibold tracking-[-0.03em] text-[var(--bokmoo-ink)]", children: "Android" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--bokmoo-copy-soft)]", children: "Android 9.0+" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-5 text-sm leading-7 text-[var(--bokmoo-copy)]", children: pickCopy(locale, {
            en: "Install from Google Play, or download the APK directly if Play is unavailable on your device.",
            hans: "\u4ECE Google Play \u5B89\u88C5\uFF1B\u5982\u679C\u8BBE\u5907\u4E0A\u6CA1\u6709 Play \u5546\u5E97\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u4E0B\u8F7D APK\u3002",
            hant: "\u5F9E Google Play \u5B89\u88DD\uFF1B\u5982\u679C\u88DD\u7F6E\u4E0A\u6C92\u6709 Play \u5546\u5E97\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u4E0B\u8F09 APK\u3002"
          }) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "group relative", children: [
              /* @__PURE__ */ jsxs(
                "a",
                {
                  href: ANDROID_PLAY_URL,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-sm font-semibold text-[var(--bokmoo-bg)]",
                  children: [
                    /* @__PURE__ */ jsx(AndroidIcon, {}),
                    pickCopy(locale, { en: "Get it on Google Play", hans: "\u901A\u8FC7 Google Play \u83B7\u53D6", hant: "\u900F\u904E Google Play \u7372\u53D6" })
                  ]
                }
              ),
              /* @__PURE__ */ jsx(QrPopover, { pathData: ANDROID_PLAY_QR_PATH, modules: 33, label: pickCopy(locale, { en: "Scan with Android", hans: "\u626B\u7801\u4E0B\u8F7D Android \u7248", hant: "\u6383\u78BC\u4E0B\u8F09 Android \u7248" }) })
            ] }),
            /* @__PURE__ */ jsxs(
              "a",
              {
                href: ANDROID_APK_URL,
                className: "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-sm font-semibold text-[var(--bokmoo-ink)]",
                children: [
                  /* @__PURE__ */ jsx(AndroidIcon, {}),
                  pickCopy(locale, { en: "Download APK directly", hans: "\u76F4\u63A5\u4E0B\u8F7D APK", hant: "\u76F4\u63A5\u4E0B\u8F09 APK" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-center text-xs text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: `Version ${ANDROID_APK_VERSION} \xB7 ${ANDROID_APK_SIZE} \xB7 allow installs from your browser when prompted.`, hans: `\u7248\u672C ${ANDROID_APK_VERSION} \xB7 ${ANDROID_APK_SIZE} \xB7 \u51FA\u73B0\u63D0\u793A\u65F6\u5141\u8BB8\u6D4F\u89C8\u5668\u5B89\u88C5\u5E94\u7528\u3002`, hant: `\u7248\u672C ${ANDROID_APK_VERSION} \xB7 ${ANDROID_APK_SIZE} \xB7 \u51FA\u73FE\u63D0\u793A\u6642\u5141\u8A31\u700F\u89BD\u5668\u5B89\u88DD\u61C9\u7528\u3002` }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "mt-10 text-center text-sm text-[var(--bokmoo-copy-soft)]", children: [
        "Questions about setup? Contact",
        " ",
        /* @__PURE__ */ jsx("a", { href: `mailto:${site.supportEmail}`, className: "text-[var(--bokmoo-gold)] hover:underline", children: site.supportEmail }),
        "."
      ] })
    ] }) });
  });

  // src/components/Footer.tsx
  var Footer = react_default.memo(function Footer2({
    locale,
    config,
    platformBranding,
    onNavigate,
    onNavigateToProducts,
    onNavigateToCategories,
    onNavigateToHelp,
    onNavigateToContact,
    onNavigateToPrivacy,
    onNavigateToTerms
  }) {
    const site = resolveBokmooSiteConfig(config);
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const showPoweredByJiffoo = platformBranding?.showPoweredByJiffoo !== false;
    const poweredByHref = platformBranding?.poweredByHref || "https://jiffoo.com";
    const poweredByLabel = platformBranding?.poweredByLabel || "Jiffoo";
    const openHref = react_default.useCallback(
      (href) => {
        if (isExternalHref(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        onNavigate?.(href);
      },
      [onNavigate]
    );
    return /* @__PURE__ */ jsxs("footer", { className: "border-t border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_72%,black),var(--bokmoo-bg))] px-4 pb-28 pt-14 sm:px-6 sm:pb-16 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-9 rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_84%,black)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: [
              /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
              pickCopy(locale, { en: "Global eSIM Infrastructure", hans: "\u5168\u7403 eSIM \u57FA\u7840\u8BBE\u65BD", hant: "\u5168\u7403 eSIM \u57FA\u790E\u8A2D\u65BD" })
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "mt-6 text-[clamp(2.4rem,4vw,4.4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Build your travel setup before departure, not after landing.", hans: "\u51FA\u53D1\u524D\u5B8C\u6210\u65C5\u6E38\u8FDE\u7EBF\u8BBE\u5B9A\uFF0C\u843D\u5730\u5373\u53EF\u4F7F\u7528\u3002", hant: "\u51FA\u767C\u524D\u5B8C\u6210\u65C5\u904A\u9023\u7DDA\u8A2D\u5B9A\uFF0C\u843D\u5730\u5373\u53EF\u4F7F\u7528\u3002" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]", children: pickCopy(locale, { en: "Explore destination-ready eSIM plans, activate profiles instantly, and manage your next trip from one premium control surface.", hans: "\u63A2\u7D22\u9002\u7528\u4E8E\u5404\u76EE\u7684\u5730\u7684 eSIM \u65B9\u6848\u3001\u5373\u65F6\u542F\u7528\u8BBE\u5B9A\u6863\uFF0C\u5E76\u96C6\u4E2D\u7BA1\u7406\u4E0B\u4E00\u8D9F\u65C5\u7A0B\u3002", hant: "\u63A2\u7D22\u9069\u7528\u65BC\u5404\u76EE\u7684\u5730\u7684 eSIM \u65B9\u6848\u3001\u5373\u6642\u555F\u7528\u8A2D\u5B9A\u6A94\uFF0C\u4E26\u96C6\u4E2D\u7BA1\u7406\u4E0B\u4E00\u8D9F\u65C5\u7A0B\u3002" }) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-col gap-3 sm:flex-row", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => openHref(site.primaryCtaHref),
                  className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]",
                  type: "button",
                  children: [
                    site.primaryCtaLabel,
                    /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => openHref(site.secondaryCtaHref),
                  className: "inline-flex min-h-12 items-center justify-center rounded-[0.9rem] border border-[var(--bokmoo-line)] px-6 text-sm font-medium text-[var(--bokmoo-ink)]",
                  type: "button",
                  children: site.secondaryCtaLabel
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid gap-6 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
                /* @__PURE__ */ jsx(Earth, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                pickCopy(locale, { en: "Product", hans: "\u4EA7\u54C1", hant: "\u7522\u54C1" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid gap-2 text-sm", children: [
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToProducts, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: pickCopy(locale, { en: "eSIM Plans", hans: "eSIM \u65B9\u6848", hant: "eSIM \u65B9\u6848" }) }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToCategories, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: pickCopy(locale, { en: "eUICC Cards", hans: "eUICC \u5361", hant: "eUICC \u5361" }) }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToHelp, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: pickCopy(locale, { en: "How It Works", hans: "\u4F7F\u7528\u65B9\u5F0F", hant: "\u4F7F\u7528\u65B9\u5F0F" }) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
                /* @__PURE__ */ jsx(Smartphone, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                pickCopy(locale, { en: "Company", hans: "\u516C\u53F8", hant: "\u516C\u53F8" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid gap-2 text-sm", children: [
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToContact, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: pickCopy(locale, { en: "Support", hans: "\u652F\u63F4", hant: "\u652F\u63F4" }) }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToPrivacy, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: pickCopy(locale, { en: "Privacy", hans: "\u9690\u79C1\u6743", hant: "\u96B1\u79C1\u6B0A" }) }),
                /* @__PURE__ */ jsx("button", { onClick: onNavigateToTerms, className: "rounded-[0.75rem] px-0 py-1 text-left text-[var(--bokmoo-copy)] hover:text-[var(--bokmoo-ink)]", type: "button", children: pickCopy(locale, { en: "Terms", hans: "\u670D\u52A1\u6761\u6B3E", hant: "\u670D\u52D9\u689D\u6B3E" }) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Contact", hans: "\u8054\u7EDC\u6211\u4EEC", hant: "\u806F\u7D61\u6211\u5011" }) }),
              /* @__PURE__ */ jsx(
                "a",
                {
                  href: `mailto:${site.supportEmail}`,
                  className: "text-sm text-[var(--bokmoo-ink)] underline decoration-[var(--bokmoo-line)] underline-offset-4",
                  children: site.supportEmail
                }
              ),
              /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm leading-7 text-[var(--bokmoo-copy)]", children: pickCopy(locale, { en: "24/7 global support for activation, compatibility, and travel profile management.", hans: "\u5168\u5929\u5019\u63D0\u4F9B\u542F\u7528\u3001\u76F8\u5BB9\u6027\u4E0E\u65C5\u6E38\u8BBE\u5B9A\u6863\u7BA1\u7406\u652F\u63F4\u3002", hant: "\u5168\u5929\u5019\u63D0\u4F9B\u555F\u7528\u3001\u76F8\u5BB9\u6027\u8207\u65C5\u904A\u8A2D\u5B9A\u6A94\u7BA1\u7406\u652F\u63F4\u3002" }) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-col gap-3 border-t border-[var(--bokmoo-line)] pt-6 text-sm text-[var(--bokmoo-copy)] sm:mt-12 sm:flex-row sm:items-center sm:justify-between", children: [
          /* @__PURE__ */ jsxs("p", { children: [
            "\xA9 ",
            year,
            " ",
            site.brandName.toUpperCase(),
            ". ",
            pickCopy(locale, { en: "Official global eSIM storefront.", hans: "\u5B98\u65B9\u5168\u7403 eSIM \u5546\u5E97\u3002", hant: "\u5B98\u65B9\u5168\u7403 eSIM \u5546\u5E97\u3002" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4", children: [
            /* @__PURE__ */ jsx("p", { children: pickCopy(locale, { en: "Boundless connectivity, secure activation, and premium travel data management.", hans: "\u65E0\u754C\u8FDE\u7EBF\u3001\u5B89\u5168\u542F\u7528\u4E0E\u4F18\u8D28\u65C5\u6E38\u6570\u636E\u7BA1\u7406\u3002", hant: "\u7121\u754C\u9023\u7DDA\u3001\u5B89\u5168\u555F\u7528\u8207\u512A\u8CEA\u65C5\u904A\u6578\u64DA\u7BA1\u7406\u3002" }) }),
            showPoweredByJiffoo ? /* @__PURE__ */ jsxs(
              "a",
              {
                href: poweredByHref,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)] transition-colors hover:text-[var(--bokmoo-gold)]",
                children: [
                  "Powered by ",
                  poweredByLabel,
                  /* @__PURE__ */ jsx(ArrowRight, { className: "h-3 w-3" })
                ]
              }
            ) : null
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "fixed inset-x-0 bottom-0 z-40 border-t border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:oklch(0.07_0.01_75_/_0.96)] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:hidden", children: /* @__PURE__ */ jsx("div", { className: "mx-auto grid max-w-[420px] grid-cols-5 gap-1", children: [
        { label: pickCopy(locale, { en: "Home", hans: "\u9996\u9875", hant: "\u9996\u9801" }), icon: House, onClick: () => onNavigate?.("/") },
        { label: pickCopy(locale, { en: "Store", hans: "\u5546\u5E97", hant: "\u5546\u5E97" }), icon: LayoutGrid, onClick: onNavigateToProducts },
        { label: pickCopy(locale, { en: "Orders", hans: "\u8BA2\u5355", hant: "\u8A02\u55AE" }), icon: ReceiptText, onClick: () => onNavigate?.("/orders") },
        { label: pickCopy(locale, { en: "Support", hans: "\u652F\u63F4", hant: "\u652F\u63F4" }), icon: LifeBuoy, onClick: onNavigateToHelp },
        { label: pickCopy(locale, { en: "Menu", hans: "\u9009\u5355", hant: "\u9078\u55AE" }), icon: Smartphone, onClick: onNavigateToCategories }
      ].map(({ label, icon: Icon2, onClick }) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick,
          className: "flex flex-col items-center justify-center gap-1 rounded-[0.85rem] border border-transparent px-2 py-2 text-[11px] text-[var(--bokmoo-copy-soft)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent)] hover:text-[var(--bokmoo-gold)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(Icon2, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsx("span", { children: label })
          ]
        },
        label
      )) }) })
    ] });
  });

  // src/components/Header.tsx
  var FOCUS_VISIBLE_RING2 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function BokmooLogoMark() {
    return /* @__PURE__ */ jsxs(
      "svg",
      {
        className: "h-7 w-[4.7rem] shrink-0 drop-shadow-[0_10px_22px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-8 sm:w-[5.35rem] xl:h-9 xl:w-24",
        viewBox: "0 38 134 50",
        fill: "none",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: "bokmoo-mark-gold", x1: "4", y1: "43", x2: "126", y2: "94", gradientUnits: "userSpaceOnUse", children: [
            /* @__PURE__ */ jsx("stop", { stopColor: "#F4CD63" }),
            /* @__PURE__ */ jsx("stop", { offset: "0.52", stopColor: "var(--bokmoo-gold)" }),
            /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#C99B3E" })
          ] }) }),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M1 85C1 61.25 17.65 42 38.2 42C58.75 42 75.4 61.25 75.4 85H57.3C57.3 72.85 48.75 63 38.2 63C27.65 63 19.1 72.85 19.1 85H1Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          ),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M56.2 85C56.2 61.25 73.35 42 94.5 42C115.65 42 132.8 61.25 132.8 85H114.2C114.2 72.85 105.38 63 94.5 63C83.62 63 74.8 72.85 74.8 85H56.2Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          ),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M27.3 85C27.3 78.08 32.18 72.48 38.2 72.48C44.22 72.48 49.1 78.08 49.1 85H27.3Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          ),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: "M83.25 85C83.25 78.08 88.29 72.48 94.5 72.48C100.71 72.48 105.75 78.08 105.75 85H83.25Z",
              fill: "url(#bokmoo-mark-gold)"
            }
          )
        ]
      }
    );
  }
  var Header = react_default.memo(function Header2({
    locale,
    isAuthenticated,
    user,
    cartItemCount,
    config,
    onNavigate,
    onLogout,
    onNavigateToCart,
    onNavigateToProfile,
    onNavigateToLogin,
    onNavigateToRegister,
    onNavigateToHome,
    onNavigateToProducts
  }) {
    const [isMenuOpen, setIsMenuOpen] = react_default.useState(false);
    const LOCALE_OPTIONS = [
      { value: "en", label: "English" },
      { value: "zh-Hans", label: "\u7B80\u4F53\u4E2D\u6587" },
      { value: "zh-Hant", label: "\u7E41\u9AD4\u4E2D\u6587" }
    ];
    const [isLocaleOpen, setIsLocaleOpen] = react_default.useState(false);
    const currentLocaleLabel = LOCALE_OPTIONS.find((option) => option.value === locale)?.label ?? "English";
    const [cartPulse, setCartPulse] = react_default.useState(false);
    const prevCartCount = react_default.useRef(cartItemCount);
    react_default.useEffect(() => {
      if (cartItemCount > prevCartCount.current) {
        setCartPulse(true);
        const timer = window.setTimeout(() => setCartPulse(false), 900);
        return () => window.clearTimeout(timer);
      }
      prevCartCount.current = cartItemCount;
    }, [cartItemCount]);
    react_default.useEffect(() => {
      prevCartCount.current = cartItemCount;
    }, [cartItemCount]);
    const switchLocale = (next) => {
      if (next === locale) {
        setIsLocaleOpen(false);
        return;
      }
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
      const path = window.location.pathname;
      const rest = path.replace(/^\/(en|zh-Hans|zh-Hant|ja|ko|fr|de)(?=\/|$)/, "");
      setIsLocaleOpen(false);
      window.location.href = `/${next}${rest === "/" ? "" : rest}`;
    };
    const site = resolveBokmooSiteConfig(config);
    const mobileMenuId = "bokmoo-mobile-menu";
    const accountInitial = ((user?.firstName || user?.email || "B").trim().charAt(0) || "B").toUpperCase();
    const openHref = react_default.useCallback(
      (href) => {
        if (isExternalHref(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        onNavigate?.(href);
      },
      [onNavigate]
    );
    const navItems = [
      { label: pickCopy(locale, { en: "Products", hans: "\u4EA7\u54C1", hant: "\u7522\u54C1", ja: "\u88FD\u54C1", ko: "\uC81C\uD488", fr: "Produits", de: "Produkte" }), onClick: onNavigateToProducts },
      { label: pickCopy(locale, { en: "Global Plans", hans: "\u5168\u7403\u5957\u9910", hant: "\u5168\u7403\u5957\u9910", ja: "\u30B0\u30ED\u30FC\u30D0\u30EB\u30D7\u30E9\u30F3", ko: "\uAE00\uB85C\uBC8C \uD50C\uB79C", fr: "Forfaits mondiaux", de: "Weltweite Tarife" }), onClick: () => openHref("/#destinations") },
      { label: pickCopy(locale, { en: "Download App", hans: "\u4E0B\u8F7D App", hant: "\u4E0B\u8F09 App", ja: "\u30A2\u30D7\u30EA\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9", ko: "\uC571 \uB2E4\uC6B4\uB85C\uB4DC", fr: "T\xE9l\xE9charger l\u2019app", de: "App herunterladen" }), onClick: () => openHref("/download/app") },
      { label: pickCopy(locale, { en: "Support", hans: "\u652F\u6301", hant: "\u652F\u63F4", ja: "\u30B5\u30DD\u30FC\u30C8", ko: "\uC9C0\uC6D0", fr: "Assistance", de: "Support" }), onClick: () => openHref("/help") },
      { label: pickCopy(locale, { en: "Affiliate", hans: "\u8054\u76DF\u8BA1\u5212", hant: "\u806F\u76DF\u8A08\u5283", ja: "\u30A2\u30D5\u30A3\u30EA\u30A8\u30A4\u30C8", ko: "\uC81C\uD734 \uD504\uB85C\uADF8\uB7A8", fr: "Affiliation", de: "Partnerprogramm" }), onClick: () => openHref("/affiliate") }
    ];
    return /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-50 border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[radial-gradient(circle_at_8%_-24%,color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent),transparent_34%),linear-gradient(180deg,oklch(0.055_0.007_75_/_0.98),oklch(0.028_0.004_75_/_0.96))] shadow-[0_18px_52px_rgba(0,0,0,0.3)] backdrop-blur-2xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-[107rem] items-center gap-3 px-4 py-2.5 sm:px-6 xl:min-h-[4.35rem] xl:gap-5 xl:px-0", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onNavigateToHome,
            className: `group flex shrink-0 items-center gap-2.5 rounded-[0.95rem] text-left sm:gap-3 ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            "aria-label": `${site.brandName} home`,
            children: [
              /* @__PURE__ */ jsx(BokmooLogoMark, {}),
              /* @__PURE__ */ jsx("span", { className: "text-[0.98rem] font-bold tracking-[0.16em] text-[var(--bokmoo-ink)] drop-shadow-[0_0_14px_color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] sm:text-[1.08rem] xl:text-[1.18rem] xl:tracking-[0.18em]", children: site.brandName.toUpperCase() })
            ]
          }
        ),
        /* @__PURE__ */ jsx("nav", { className: "ml-8 hidden items-center gap-8 xl:flex 2xl:ml-14 2xl:gap-10", children: navItems.map((item) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => {
              item.onClick();
              setIsMenuOpen(false);
            },
            className: `group relative rounded-[0.75rem] px-1 py-2.5 text-[0.95rem] font-medium tracking-[-0.01em] text-[color:color-mix(in_oklab,var(--bokmoo-copy)_88%,white)] transition-colors duration-300 hover:text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            children: [
              /* @__PURE__ */ jsx("span", { className: "absolute inset-x-0 bottom-1 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,var(--bokmoo-gold),transparent)] transition-transform duration-300 group-hover:scale-x-100" }),
              item.label
            ]
          },
          item.label
        )) }),
        /* @__PURE__ */ jsxs("div", { className: "ml-auto hidden items-center gap-3 xl:flex", children: [
          /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setIsLocaleOpen((open) => !open),
                className: `inline-flex min-h-[2.75rem] items-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.012))] px-4 text-sm text-[var(--bokmoo-copy)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_48%,transparent)] hover:text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
                type: "button",
                children: [
                  /* @__PURE__ */ jsx(Earth, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                  currentLocaleLabel,
                  /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4" })
                ]
              }
            ),
            isLocaleOpen && /* @__PURE__ */ jsx("div", { className: "absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,black)] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]", children: LOCALE_OPTIONS.map((option) => /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => switchLocale(option.value),
                className: `flex w-full items-center justify-between rounded-[0.6rem] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] ${option.value === locale ? "font-semibold text-[var(--bokmoo-gold)]" : "text-[var(--bokmoo-copy)]"}`,
                type: "button",
                children: [
                  option.label,
                  option.value === locale && /* @__PURE__ */ jsx("span", { className: "text-xs", children: "\u2713" })
                ]
              },
              option.value
            )) })
          ] }),
          isAuthenticated ? /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: onNavigateToProfile,
              className: `inline-flex min-h-[2.75rem] items-center gap-2.5 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.16))] pl-1.5 pr-4 text-sm font-semibold text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_54%,transparent)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: [
                /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_86%,white),color-mix(in_oklab,var(--bokmoo-gold)_66%,black))] text-[0.8rem] font-bold text-[var(--bokmoo-bg)]", children: accountInitial }),
                pickCopy(locale, { en: "My Account", hans: "\u6211\u7684\u5E10\u6237", hant: "\u6211\u7684\u5E33\u6236", ja: "\u30DE\u30A4\u30A2\u30AB\u30A6\u30F3\u30C8", ko: "\uB0B4 \uACC4\uC815", fr: "Mon compte", de: "Mein Konto" }),
                /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4 text-[var(--bokmoo-copy-soft)]" })
              ]
            }
          ) : /* @__PURE__ */ jsxs(Fragment2, { children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: onNavigateToLogin,
                className: `inline-flex min-h-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.16))] px-5 text-sm font-medium text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING2}`,
                type: "button",
                children: pickCopy(locale, { en: "Log In", hans: "\u767B\u5165", hant: "\u767B\u5165" })
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: onNavigateToRegister,
                className: `inline-flex min-h-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_46%,white)] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-6 text-sm font-bold tracking-[0.01em] text-[var(--bokmoo-bg)] shadow-[0_14px_30px_color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),inset_0_1px_0_rgba(255,255,255,0.34)] transition-transform duration-300 hover:-translate-y-0.5 ${FOCUS_VISIBLE_RING2}`,
                type: "button",
                children: pickCopy(locale, { en: "Get Started", hans: "\u7ACB\u5373\u5F00\u59CB", hant: "\u7ACB\u5373\u958B\u59CB" })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: onNavigateToCart,
              className: `relative inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.18))] text-[var(--bokmoo-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING2}`,
              "aria-label": pickCopy(locale, { en: "Open cart", hans: "\u5F00\u542F\u8D2D\u7269\u8F66", hant: "\u958B\u555F\u8CFC\u7269\u8ECA", ja: "\u30AB\u30FC\u30C8\u3092\u958B\u304F", ko: "\uC7A5\uBC14\uAD6C\uB2C8 \uC5F4\uAE30", fr: "Ouvrir le panier", de: "Warenkorb \xF6ffnen" }),
              type: "button",
              children: [
                /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4" }),
                cartItemCount > 0 ? /* @__PURE__ */ jsx("span", { className: "absolute -right-1 -top-1 flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--bokmoo-gold)] px-1 text-[10px] font-bold text-[var(--bokmoo-bg)] cart-pulse", children: cartItemCount > 99 ? "99+" : cartItemCount }) : null
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setIsMenuOpen((value) => !value),
            className: `ml-auto flex h-11 w-11 items-center justify-center rounded-[0.8rem] border border-[var(--bokmoo-line)] text-[var(--bokmoo-ink)] xl:hidden ${FOCUS_VISIBLE_RING2}`,
            "aria-controls": mobileMenuId,
            "aria-expanded": isMenuOpen,
            "aria-label": isMenuOpen ? pickCopy(locale, { en: "Close menu", hans: "\u5173\u95ED\u9009\u5355", hant: "\u95DC\u9589\u9078\u55AE" }) : pickCopy(locale, { en: "Open menu", hans: "\u5F00\u542F\u9009\u5355", hant: "\u958B\u555F\u9078\u55AE" }),
            type: "button",
            children: isMenuOpen ? /* @__PURE__ */ jsx(X, { className: "h-5 w-5" }) : /* @__PURE__ */ jsx(Menu, { className: "h-5 w-5" })
          }
        )
      ] }),
      isMenuOpen ? /* @__PURE__ */ jsx("div", { id: mobileMenuId, className: "border-t border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-4 xl:hidden", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
        navItems.map((item) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              item.onClick();
              setIsMenuOpen(false);
            },
            className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            children: item.label
          },
          item.label
        )),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              onNavigateToCart();
              setIsMenuOpen(false);
            },
            className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
            type: "button",
            children: pickCopy(locale, { en: "Cart", hans: "\u8D2D\u7269\u8F66", hant: "\u8CFC\u7269\u8ECA" })
          }
        ),
        isAuthenticated ? /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onNavigateToProfile();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: pickCopy(locale, { en: "My Account", hans: "\u6211\u7684\u5E10\u6237", hant: "\u6211\u7684\u5E33\u6236", ja: "\u30DE\u30A4\u30A2\u30AB\u30A6\u30F3\u30C8", ko: "\uB0B4 \uACC4\uC815", fr: "Mon compte", de: "Mein Konto" })
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onLogout();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-copy)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: pickCopy(locale, { en: "Log Out", hans: "\u767B\u51FA", hant: "\u767B\u51FA" })
            }
          )
        ] }) : /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onNavigateToLogin();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-left text-sm font-medium text-[var(--bokmoo-ink)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: pickCopy(locale, { en: "Log In", hans: "\u767B\u5165", hant: "\u767B\u5165" })
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                onNavigateToRegister();
                setIsMenuOpen(false);
              },
              className: `rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-4 py-3 text-left text-sm font-semibold text-[var(--bokmoo-bg)] ${FOCUS_VISIBLE_RING2}`,
              type: "button",
              children: pickCopy(locale, { en: "Get Started", hans: "\u7ACB\u5373\u5F00\u59CB", hant: "\u7ACB\u5373\u958B\u59CB" })
            }
          )
        ] })
      ] }) }) : null
    ] });
  });

  // src/components/HelpPage.tsx
  var topics = [
    {
      title: { en: "How to install eSIM", hans: "\u5982\u4F55\u5B89\u88C5 eSIM", hant: "\u5982\u4F55\u5B89\u88DD eSIM" },
      subtitle: { en: "Step-by-step guide", hans: "\u5206\u6B65\u6307\u5357", hant: "\u5206\u6B65\u6307\u5357" },
      icon: QrCode
    },
    {
      title: { en: "How eSIM works", hans: "eSIM \u7684\u5DE5\u4F5C\u539F\u7406", hant: "eSIM \u7684\u5DE5\u4F5C\u539F\u7406" },
      subtitle: { en: "Learn the basics", hans: "\u4E86\u89E3\u57FA\u7840\u77E5\u8BC6", hant: "\u4E86\u89E3\u57FA\u790E\u77E5\u8B58" },
      icon: Earth
    },
    {
      title: { en: "Supported devices", hans: "\u652F\u6301\u7684\u8BBE\u5907", hant: "\u652F\u63F4\u7684\u88DD\u7F6E" },
      subtitle: { en: "Check compatibility", hans: "\u67E5\u770B\u517C\u5BB9\u6027", hant: "\u67E5\u770B\u76F8\u5BB9\u6027" },
      icon: ShieldCheck
    },
    {
      title: { en: "Top up & Data plans", hans: "\u5145\u503C\u4E0E\u6D41\u91CF\u5957\u9910", hant: "\u5145\u503C\u8207\u6D41\u91CF\u5957\u9910" },
      subtitle: { en: "Manage your plan", hans: "\u7BA1\u7406\u4F60\u7684\u5957\u9910", hant: "\u7BA1\u7406\u4F60\u7684\u5957\u9910" },
      icon: Signal
    }
  ];
  var HelpPage = react_default.memo(function HelpPage2({ onNavigateToContact, locale }) {
    const t = (copy) => pickCopy(locale, copy);
    const [query, setQuery] = react_default.useState("");
    const filtered = topics.filter(
      (topic) => !query ? true : `${topic.title.en} ${topic.title.hans} ${topic.title.hant} ${topic.subtitle.en} ${topic.subtitle.hans} ${topic.subtitle.hant}`.toLowerCase().includes(query.toLowerCase())
    );
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[980px]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-5 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.6rem] sm:p-8", children: [
      /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between gap-4", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]", children: "BOKMOO" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-3 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "Help Center", hans: "\u5E2E\u52A9\u4E2D\u5FC3", hant: "\u5E6B\u52A9\u4E2D\u5FC3" }) })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "mt-6", children: /* @__PURE__ */ jsx(
        "input",
        {
          value: query,
          onChange: (event) => setQuery(event.target.value),
          placeholder: t({ en: "Search for help...", hans: "\u641C\u7D22\u5E2E\u52A9\u2026", hant: "\u641C\u5C0B\u5E6B\u52A9\u2026" }),
          className: "h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]"
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, { en: "Popular Topics", hans: "\u70ED\u95E8\u4E3B\u9898", hant: "\u71B1\u9580\u4E3B\u984C" }) }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: filtered.map(({ title, subtitle, icon: Icon2 }) => /* @__PURE__ */ jsxs(
          "button",
          {
            className: "flex items-center justify-between rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-4 text-left transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_32%,var(--bokmoo-line))] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_82%,black)]",
            type: "button",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-5 w-5" }) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, title) }),
                  /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: pickCopy(locale, subtitle) })
                ] })
              ] }),
              /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4 text-[var(--bokmoo-copy-soft)]" })
            ]
          },
          title.en
        )) })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => onNavigateToContact?.(),
          className: "mt-8 inline-flex min-h-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]",
          type: "button",
          children: t({ en: "Contact Support", hans: "\u8054\u7CFB\u652F\u6301", hant: "\u806F\u7D61\u652F\u63F4" })
        }
      )
    ] }) }) });
  });

  // src/components/HomePage.tsx
  function HeroPillar({ className }) {
    return /* @__PURE__ */ jsx("div", { className: `pointer-events-none absolute rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] ${className}` });
  }
  function AppleIcon2() {
    return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "h-5 w-5", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" }) });
  }
  function PlayIcon() {
    return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "h-5 w-5", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M3.61 1.81L13.79 12 3.61 22.19a1.5 1.5 0 01-.44-1.06V2.87c0-.41.16-.78.44-1.06zm11.6 11.6l2.52 2.52-9.72 5.47 7.2-7.99zm4.99-4.11c.36.34.58.81.58 1.34v2.72c0 .53-.22 1-.58 1.34l-2.88 2.88-2.76-2.76 2.76-2.77-2.76-2.76 2.76-2.76 2.88 2.77zm-12.19-8.8l9.72 5.46-2.52 2.52-7.2-7.98z" }) });
  }
  function SectionEyebrow({ children }) {
    return /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--bokmoo-gold)]", children });
  }
  var HERO_STATS = [
    { value: "200+", label: { en: "Countries & regions", hans: "\u56FD\u5BB6\u548C\u5730\u533A", hant: "\u570B\u5BB6\u548C\u5730\u5340" } },
    { value: "1000+", label: { en: "Carrier plans", hans: "\u8FD0\u8425\u5546\u5957\u9910", hant: "\u71DF\u904B\u5546\u5957\u9910" } },
    { value: "15\u201320", label: { en: "Plans per card", hans: "\u5957\u9910/\u5F20\u5361", hant: "\u5957\u9910/\u5F35\u5361" } }
  ];
  var DESTINATIONS = [
    { name: { en: "Japan", hans: "\u65E5\u672C", hant: "\u65E5\u672C" }, flag: "\u{1F1EF}\u{1F1F5}", image: "/theme-assets/bokmoo/bokmoo-dest-japan.jpg" },
    { name: { en: "France", hans: "\u6CD5\u56FD", hant: "\u6CD5\u570B" }, flag: "\u{1F1EB}\u{1F1F7}", image: "/theme-assets/bokmoo/bokmoo-dest-france.jpg" },
    { name: { en: "Singapore", hans: "\u65B0\u52A0\u5761", hant: "\u65B0\u52A0\u5761" }, flag: "\u{1F1F8}\u{1F1EC}", image: "/theme-assets/bokmoo/bokmoo-dest-singapore.jpg" },
    { name: { en: "United States", hans: "\u7F8E\u56FD", hant: "\u7F8E\u570B" }, flag: "\u{1F1FA}\u{1F1F8}", image: "/theme-assets/bokmoo/bokmoo-dest-usa.jpg" }
  ];
  var HomePage = react_default.memo(function HomePage2({ locale, config, onNavigate }) {
    const site = resolveBokmooSiteConfig(config, locale);
    const t = (copy) => pickCopy(locale, copy);
    const openHref = react_default.useCallback(
      (href) => {
        if (isExternalHref(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        onNavigate?.(href);
      },
      [onNavigate]
    );
    const heroStats = HERO_STATS.map((stat) => ({
      value: stat.value,
      label: t(stat.label)
    }));
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-[#08070a] text-[var(--bokmoo-ink)]", children: [
      /* @__PURE__ */ jsxs("section", { className: "relative overflow-hidden border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)]", children: [
        /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_35%,color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent),transparent_55%)]" }),
        /* @__PURE__ */ jsx(HeroPillar, { className: "left-[58%] top-[-20%] hidden h-[130%] w-[28rem] lg:block" }),
        /* @__PURE__ */ jsx(HeroPillar, { className: "left-[70%] top-[-10%] hidden h-[150%] w-[36rem] lg:block" }),
        /* @__PURE__ */ jsxs("div", { className: "relative mx-auto grid max-w-[1180px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-20", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h1", { className: "text-[clamp(3.4rem,8vw,6.4rem)] font-bold leading-[0.92] tracking-[-0.02em] text-white", children: "BOKMOO" }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tracking-[-0.02em] text-[var(--bokmoo-gold)]", children: t({ en: "One card, connected to your world.", hans: "\u4E00\u5F20\u5361\uFF0C\u8FDE\u63A5\u4F60\u7684\u4E16\u754C\u3002", hant: "\u4E00\u5F35\u5361\uFF0C\u9023\u63A5\u4F60\u7684\u4E16\u754C\u3002" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-6 max-w-xl text-base leading-8 text-[var(--bokmoo-copy)]", children: t({
              en: "A physical eSIM card that makes global connectivity simple. 200+ countries and regions, flexible plans, effortless management.",
              hans: "\u5B9E\u4F53 eSIM \u5361\uFF0C\u8BA9\u5168\u7403\u8FDE\u63A5\u66F4\u7B80\u5355\u3002\u652F\u6301 200+ \u56FD\u5BB6\u548C\u5730\u533A\uFF0C\u7075\u6D3B\u5957\u9910\uFF0C\u8F7B\u677E\u7BA1\u7406\u3002",
              hant: "\u5BE6\u9AD4 eSIM \u5361\uFF0C\u8B93\u5168\u7403\u9023\u63A5\u66F4\u7C21\u55AE\u3002\u652F\u63F4 200+ \u570B\u5BB6\u548C\u5730\u5340\uFF0C\u9748\u6D3B\u5957\u9910\uFF0C\u8F15\u9B06\u7BA1\u7406\u3002"
            }) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-wrap items-center gap-4", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => openHref("/products"),
                  className: "btn-shimmer inline-flex min-h-12 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[#141210]",
                  type: "button",
                  children: [
                    t({ en: "Explore BOKMOO", hans: "\u63A2\u7D22 BOKMOO", hant: "\u63A2\u7D22 BOKMOO" }),
                    /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => openHref("/download/app"),
                  className: "btn-shimmer inline-flex min-h-12 items-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] px-6 text-sm font-semibold text-[var(--bokmoo-ink)]",
                  type: "button",
                  children: [
                    t({ en: "Download the App", hans: "\u4E0B\u8F7D App", hant: "\u4E0B\u8F09 App" }),
                    /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] pt-7", children: heroStats.map((stat) => /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-2xl font-bold tracking-[-0.02em] text-white sm:text-3xl", children: stat.value }),
              /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-xs leading-5 text-[var(--bokmoo-copy-soft)]", children: stat.label })
            ] }, stat.value)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_50%,color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent),transparent_60%)]" }),
            /* @__PURE__ */ jsx(
              "img",
              {
                src: "/theme-assets/bokmoo/bokmoo-hero-card-pair.jpg",
                alt: "BOKMOO",
                className: "relative w-full rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] object-cover",
                loading: "eager"
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("section", { className: "border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] bg-[#0b0a0d]", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20", children: [
        /* @__PURE__ */ jsx(SectionEyebrow, { children: t({ en: "BOKMOO products", hans: "BOKMOO \u4EA7\u54C1", hant: "BOKMOO \u7522\u54C1" }) }),
        /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white", children: t({ en: "Find the connection that fits you", hans: "\u627E\u5230\u9002\u5408\u4F60\u7684\u8FDE\u63A5\u65B9\u5F0F", hant: "\u627E\u5230\u9069\u5408\u4F60\u7684\u9023\u63A5\u65B9\u5F0F" }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]", children: t({
          en: "One physical card managing multiple eSIM plans \u2014 built for different countries and every kind of trip.",
          hans: "\u4E00\u5F20\u5B9E\u4F53\u5361\uFF0C\u7BA1\u7406\u591A\u4E2A eSIM \u5957\u9910\uFF0C\u6EE1\u8DB3\u4E0D\u540C\u56FD\u5BB6\u3001\u4E0D\u540C\u573A\u666F\u7684\u51FA\u884C\u9700\u6C42\u3002",
          hant: "\u4E00\u5F35\u5BE6\u9AD4\u5361\uFF0C\u7BA1\u7406\u591A\u500B eSIM \u5957\u9910\uFF0C\u6EFF\u8DB3\u4E0D\u540C\u570B\u5BB6\u3001\u4E0D\u540C\u5834\u666F\u7684\u51FA\u884C\u9700\u6C42\u3002"
        }) }),
        /* @__PURE__ */ jsxs("div", { className: "mt-12 grid items-center gap-10 overflow-hidden rounded-[1.4rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[linear-gradient(120deg,#171310_0%,#0c0b0e_55%,#08070a_100%)] p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]", children: [
          /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_50%,color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent),transparent_62%)]" }),
            /* @__PURE__ */ jsx(
              "img",
              {
                src: "/theme-assets/bokmoo/bokmoo-hero-card-pair.jpg",
                alt: t({ en: "BOKMOO eSIM Card", hans: "BOKMOO eSIM \u5361", hant: "BOKMOO eSIM \u5361" }),
                className: "relative w-full rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] object-cover",
                loading: "lazy"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-2xl font-bold tracking-[-0.02em] text-white", children: t({ en: "BOKMOO eSIM Card", hans: "BOKMOO eSIM \u5361", hant: "BOKMOO eSIM \u5361" }) }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]", children: t({ en: "One physical card, multiple eSIM plans.", hans: "\u4E00\u5F20\u5B9E\u4F53\u5361\uFF0C\u7BA1\u7406\u591A\u4E2A eSIM \u5957\u9910\u3002", hant: "\u4E00\u5F35\u5BE6\u9AD4\u5361\uFF0C\u7BA1\u7406\u591A\u500B eSIM \u5957\u9910\u3002" }) }),
            /* @__PURE__ */ jsx("ul", { className: "mt-7 grid gap-4 sm:grid-cols-2", children: [
              { en: "1.6MB capacity", hans: "1.6MB \u5927\u5BB9\u91CF", hant: "1.6MB \u5927\u5BB9\u91CF" },
              { en: "SGP.22 / SGP.32", hans: "SGP.22 / SGP.32", hant: "SGP.22 / SGP.32" },
              { en: "15\u201320 plans per card", hans: "\u652F\u6301 15-20 \u4E2A\u5957\u9910", hant: "\u652F\u63F4 15-20 \u500B\u5957\u9910" },
              { en: "GSMA certified", hans: "GSMA \u8BA4\u8BC1", hant: "GSMA \u8A8D\u8B49" }
            ].map((feature) => /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-3 text-sm text-[var(--bokmoo-ink)]", children: [
              /* @__PURE__ */ jsx("span", { className: "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5" }) }),
              t(feature)
            ] }, feature.en)) }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => openHref("/products"),
                className: "mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--bokmoo-gold)] hover:underline",
                type: "button",
                children: [
                  t({ en: "Learn more", hans: "\u4E86\u89E3\u4EA7\u54C1", hant: "\u4E86\u89E3\u7522\u54C1" }),
                  /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                ]
              }
            )
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("section", { className: "border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)]", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20", children: [
        /* @__PURE__ */ jsx(SectionEyebrow, { children: t({ en: "BOKMOO App", hans: "BOKMOO App", hant: "BOKMOO App" }) }),
        /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white", children: t({ en: "Your plans, in your grasp.", hans: "\u4F60\u7684\u5957\u9910\uFF0C\u5C3D\u5728\u638C\u63E1\u3002", hant: "\u4F60\u7684\u5957\u9910\uFF0C\u76E1\u5728\u638C\u63E1\u3002" }) }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]", children: t({
          en: "Scan to add, review cards, switch plans \u2014 one app does it all.",
          hans: "\u626B\u7801\u6DFB\u52A0\u3001\u67E5\u770B\u5361\u7247\u3001\u5207\u6362\u5957\u9910\uFF0C\u4E00\u4E2A App \u5B8C\u6210\u3002",
          hant: "\u6383\u78BC\u6DFB\u52A0\u3001\u67E5\u770B\u5361\u7247\u3001\u5207\u63DB\u5957\u9910\uFF0C\u4E00\u500B App \u5B8C\u6210\u3002"
        }) }),
        /* @__PURE__ */ jsxs("div", { className: "mt-12 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("ul", { className: "grid gap-8", children: [
              {
                icon: /* @__PURE__ */ jsx(QrCode, { className: "h-5 w-5" }),
                title: { en: "Scan to add eSIMs", hans: "\u626B\u7801\u6DFB\u52A0 eSIM", hant: "\u6383\u78BC\u6DFB\u52A0 eSIM" },
                copy: { en: "Quick scan, effortless plan setup.", hans: "\u5FEB\u901F\u626B\u63CF\uFF0C\u8F7B\u677E\u6DFB\u52A0\u5957\u9910\u3002", hant: "\u5FEB\u901F\u6383\u63CF\uFF0C\u8F15\u9B06\u6DFB\u52A0\u5957\u9910\u3002" }
              },
              {
                icon: /* @__PURE__ */ jsx(Layers, { className: "h-5 w-5" }),
                title: { en: "Manage plans per card", hans: "\u6309\u5361\u7247\u7BA1\u7406\u5957\u9910", hant: "\u6309\u5361\u7247\u7BA1\u7406\u5957\u9910" },
                copy: { en: "Multiple cards, clearly organized.", hans: "\u591A\u5F20\u5361\u7247\uFF0C\u6E05\u6670\u7BA1\u7406\u3002", hant: "\u591A\u5F35\u5361\u7247\uFF0C\u6E05\u6670\u7BA1\u7406\u3002" }
              },
              {
                icon: /* @__PURE__ */ jsx(ArrowLeftRight, { className: "h-5 w-5" }),
                title: { en: "View & switch anytime", hans: "\u968F\u65F6\u67E5\u770B\u4E0E\u5207\u6362", hant: "\u96A8\u6642\u67E5\u770B\u8207\u5207\u63DB" },
                copy: { en: "One-tap switching for flexible travel.", hans: "\u4E00\u952E\u5207\u6362\uFF0C\u51FA\u884C\u66F4\u7075\u6D3B\u3002", hant: "\u4E00\u9375\u5207\u63DB\uFF0C\u51FA\u884C\u66F4\u9748\u6D3B\u3002" }
              }
            ].map((feature) => /* @__PURE__ */ jsxs("li", { className: "flex gap-5", children: [
              /* @__PURE__ */ jsx("span", { className: "mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] text-[var(--bokmoo-gold)]", children: feature.icon }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-base font-semibold text-[var(--bokmoo-ink)]", children: t(feature.title) }),
                /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-sm leading-6 text-[var(--bokmoo-copy)]", children: t(feature.copy) })
              ] })
            ] }, feature.title.en)) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-10 flex flex-wrap gap-4", children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => openHref("/download/app"),
                  className: "btn-shimmer inline-flex min-h-13 items-center gap-3 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_30%,transparent)] bg-[#0d0c0f] px-6 py-3 text-left",
                  type: "button",
                  children: [
                    /* @__PURE__ */ jsx(AppleIcon2, {}),
                    /* @__PURE__ */ jsxs("span", { children: [
                      /* @__PURE__ */ jsx("span", { className: "block text-[0.65rem] uppercase tracking-wide text-[var(--bokmoo-copy-soft)]", children: t({ en: "Download on the", hans: "\u4E0B\u8F7D\u5230", hant: "\u4E0B\u8F09\u5230" }) }),
                      /* @__PURE__ */ jsx("span", { className: "block text-base font-semibold text-[var(--bokmoo-ink)]", children: "App Store" })
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => openHref("/download/app"),
                  className: "btn-shimmer inline-flex min-h-13 items-center gap-3 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_30%,transparent)] bg-[#0d0c0f] px-6 py-3 text-left",
                  type: "button",
                  children: [
                    /* @__PURE__ */ jsx(PlayIcon, {}),
                    /* @__PURE__ */ jsxs("span", { children: [
                      /* @__PURE__ */ jsx("span", { className: "block text-[0.65rem] uppercase tracking-wide text-[var(--bokmoo-copy-soft)]", children: t({ en: "Download on", hans: "\u4E0B\u8F7D\u5230", hant: "\u4E0B\u8F09\u5230" }) }),
                      /* @__PURE__ */ jsx("span", { className: "block text-base font-semibold text-[var(--bokmoo-ink)]", children: "Google Play" })
                    ] })
                  ]
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "relative mx-auto w-full max-w-[19rem]", children: [
            /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_65%)]" }),
            /* @__PURE__ */ jsx("div", { className: "relative rounded-[2.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] bg-[#050408] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.6)]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.8rem] bg-[#0b0a0d] p-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-[0.65rem] text-[var(--bokmoo-copy-soft)]", children: [
                /* @__PURE__ */ jsx("span", { children: "9:41" }),
                /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ jsx("span", { className: "inline-block h-1 w-3 rounded-full bg-[var(--bokmoo-copy-soft)]" }),
                  /* @__PURE__ */ jsx("span", { className: "inline-block h-2 w-2 rounded-full border border-[var(--bokmoo-copy-soft)]" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "text-sm font-bold tracking-tight text-[var(--bokmoo-gold)]", children: "BOKMOO" }),
                /* @__PURE__ */ jsx("span", { className: "text-[var(--bokmoo-copy-soft)]", children: "\u2699" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] bg-[#121016] p-3", children: [
                /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-1.5 text-[0.65rem] text-[#4ade80]", children: [
                  /* @__PURE__ */ jsx("span", { className: "inline-block h-1.5 w-1.5 rounded-full bg-[#4ade80]" }),
                  t({ en: "Connected", hans: "\u5DF2\u8FDE\u63A5", hant: "\u5DF2\u9023\u7DDA" })
                ] }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs font-semibold text-[var(--bokmoo-ink)]", children: t({ en: "BOKMOO Card", hans: "BOKMOO \u5361\u7247", hant: "BOKMOO \u5361\u7247" }) }),
                /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[0.6rem] tracking-wide text-[var(--bokmoo-copy-soft)]", children: "EID 8903****\u2026S287" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-[var(--bokmoo-ink)]", children: t({ en: "eSIM list (2)", hans: "eSIM \u5217\u8868\uFF082\uFF09", hant: "eSIM \u5217\u8868\uFF082\uFF09" }) }),
                /* @__PURE__ */ jsx("span", { className: "rounded-full bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,transparent)] px-2 py-0.5 text-[0.6rem] text-[var(--bokmoo-gold)]", children: "+ eSIM" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "mt-3 space-y-2", children: [
                { flag: "\u{1F1EF}\u{1F1F5}", name: { en: "Japan", hans: "\u65E5\u672C", hant: "\u65E5\u672C" }, state: { en: "Active", hans: "\u4F7F\u7528\u4E2D", hant: "\u4F7F\u7528\u4E2D" }, on: true },
                { flag: "\u{1F1EB}\u{1F1F7}", name: { en: "France", hans: "\u6CD5\u56FD", hant: "\u6CD5\u570B" }, state: { en: "Unused", hans: "\u672A\u5E94\u7528", hant: "\u672A\u61C9\u7528" }, on: false },
                { flag: "\u{1F1F8}\u{1F1EC}", name: { en: "Singapore", hans: "\u65B0\u52A0\u5761", hant: "\u65B0\u52A0\u5761" }, state: { en: "Unused", hans: "\u672A\u5E94\u7528", hant: "\u672A\u61C9\u7528" }, on: false }
              ].map((row) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-[0.8rem] bg-[#141218] px-3 py-2.5", children: [
                /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 text-xs text-[var(--bokmoo-ink)]", children: [
                  /* @__PURE__ */ jsx("span", { children: row.flag }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    t(row.name),
                    /* @__PURE__ */ jsx("span", { className: "ml-1.5 rounded bg-[#221e28] px-1 py-0.5 text-[0.55rem] text-[var(--bokmoo-copy-soft)]", children: t(row.state) })
                  ] })
                ] }),
                /* @__PURE__ */ jsx("span", { className: `inline-flex h-3.5 w-6 items-center rounded-full p-0.5 ${row.on ? "bg-[var(--bokmoo-gold)]" : "bg-[#2c2830]"}`, children: /* @__PURE__ */ jsx("span", { className: `h-2.5 w-2.5 rounded-full bg-white transition-transform ${row.on ? "translate-x-3" : ""}` }) })
              ] }, row.name.en)) })
            ] }) })
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("section", { id: "destinations", className: "scroll-mt-24 border-b border-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] bg-[#0b0a0d]", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end justify-between gap-6", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(SectionEyebrow, { children: t({ en: "Popular destinations", hans: "\u70ED\u95E8\u76EE\u7684\u5730", hant: "\u71B1\u9580\u76EE\u7684\u5730" }) }),
            /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white", children: t({ en: "Where to next?", hans: "\u4E0B\u4E00\u7AD9\uFF0C\u53BB\u54EA\u91CC\uFF1F", hant: "\u4E0B\u4E00\u7AD9\uFF0C\u53BB\u54EA\u88E1\uFF1F" }) })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "flex min-h-11 w-full max-w-xs items-center gap-3 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent)] bg-[#0d0c0f] px-4 text-sm text-[var(--bokmoo-copy-soft)]", children: [
            /* @__PURE__ */ jsx(Search, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                "aria-label": t({ en: "Search a country or region", hans: "\u641C\u7D22\u56FD\u5BB6\u6216\u5730\u533A", hant: "\u641C\u5C0B\u570B\u5BB6\u6216\u5730\u5340" }),
                placeholder: t({ en: "Search a country or region", hans: "\u641C\u7D22\u56FD\u5BB6\u6216\u5730\u533A", hant: "\u641C\u5C0B\u570B\u5BB6\u6216\u5730\u5340" }),
                className: "w-full border-0 bg-transparent p-0 outline-none ring-0 placeholder:text-[var(--bokmoo-copy-soft)] focus:ring-0",
                onKeyDown: (event) => {
                  if (event.key === "Enter") {
                    const value = event.target.value.trim();
                    openHref(value ? `/products?search=${encodeURIComponent(value)}` : "/products");
                  }
                }
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4", children: DESTINATIONS.map((destination) => /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => openHref("/products"),
            className: "group relative overflow-hidden rounded-[1.1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] text-left",
            type: "button",
            children: [
              /* @__PURE__ */ jsx(
                "img",
                {
                  src: destination.image,
                  alt: t(destination.name),
                  className: "aspect-[6/5] w-full object-cover transition-transform duration-500 group-hover:scale-105",
                  loading: "lazy"
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(4,3,6,0.88)_100%)]" }),
              /* @__PURE__ */ jsxs("div", { className: "absolute inset-x-0 bottom-0 flex items-center justify-between p-4", children: [
                /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [
                  /* @__PURE__ */ jsx("span", { children: destination.flag }),
                  t(destination.name)
                ] }),
                /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-medium text-[var(--bokmoo-gold)]", children: [
                  t({ en: "View plans", hans: "\u67E5\u770B\u5957\u9910", hant: "\u67E5\u770B\u5957\u9910" }),
                  /* @__PURE__ */ jsx(ArrowRight, { className: "h-3 w-3" })
                ] })
              ] })
            ]
          },
          destination.name.en
        )) })
      ] }) }),
      /* @__PURE__ */ jsx("section", { children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:py-20", children: [
        /* @__PURE__ */ jsx(SectionEyebrow, { children: t({ en: "How to start", hans: "\u5982\u4F55\u5F00\u59CB", hant: "\u5982\u4F55\u958B\u59CB" }) }),
        /* @__PURE__ */ jsx("h2", { className: "mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)] font-bold tracking-[-0.02em] text-white", children: t({ en: "From card to connected world.", hans: "\u4ECE\u8FDE\u63A5\u5361\u7247\uFF0C\u5230\u8FDE\u63A5\u4E16\u754C\u3002", hant: "\u5F9E\u9023\u63A5\u5361\u7247\uFF0C\u5230\u9023\u63A5\u4E16\u754C\u3002" }) }),
        /* @__PURE__ */ jsx("div", { className: "mt-12 grid gap-10 md:grid-cols-3", children: [
          {
            step: "01",
            icon: /* @__PURE__ */ jsx(Smartphone, { className: "h-5 w-5" }),
            title: { en: "Connect the card", hans: "\u8FDE\u63A5\u5361\u7247", hant: "\u9023\u63A5\u5361\u7247" },
            copy: { en: "Connect the physical eSIM card to the app.", hans: "\u901A\u8FC7\u5B9E\u4F53 eSIM \u5361\u8FDE\u63A5\u5230 App\u3002", hant: "\u900F\u904E\u5BE6\u9AD4 eSIM \u5361\u9023\u63A5\u5230 App\u3002" }
          },
          {
            step: "02",
            icon: /* @__PURE__ */ jsx(QrCode, { className: "h-5 w-5" }),
            title: { en: "Add an eSIM", hans: "\u6DFB\u52A0 eSIM", hant: "\u6DFB\u52A0 eSIM" },
            copy: { en: "Scan or pick a plan and add it to your card.", hans: "\u626B\u7801\u6216\u9009\u62E9\u5957\u9910\uFF0C\u6DFB\u52A0\u5230\u5361\u7247\u3002", hant: "\u6383\u78BC\u6216\u9078\u64C7\u5957\u9910\uFF0C\u6DFB\u52A0\u5230\u5361\u7247\u3002" }
          },
          {
            step: "03",
            icon: /* @__PURE__ */ jsx(ArrowLeftRight, { className: "h-5 w-5" }),
            title: { en: "Switch plans", hans: "\u5207\u6362\u5957\u9910", hant: "\u5207\u63DB\u5957\u9910" },
            copy: { en: "Review and switch in the app \u2014 one card, many destinations.", hans: "\u5728 App \u4E2D\u968F\u65F6\u67E5\u770B\u4E0E\u5207\u6362\uFF0C\u4E00\u5F20\u5361\u8F7B\u677E\u7BA1\u7406\u591A\u4E2A\u76EE\u7684\u5730\u3002", hant: "\u5728 App \u4E2D\u96A8\u6642\u67E5\u770B\u8207\u5207\u63DB\uFF0C\u4E00\u5F35\u5361\u8F15\u9B06\u7BA1\u7406\u591A\u500B\u76EE\u7684\u5730\u3002" }
          }
        ].map((step) => /* @__PURE__ */ jsxs("div", { className: "flex gap-5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-3xl font-bold text-[var(--bokmoo-gold)]", children: step.step }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { className: "inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_26%,transparent)] text-[var(--bokmoo-gold)]", children: step.icon }),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-base font-semibold text-[var(--bokmoo-ink)]", children: t(step.title) }),
            /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--bokmoo-copy)]", children: t(step.copy) })
          ] })
        ] }, step.step)) }),
        /* @__PURE__ */ jsxs("div", { className: "mt-14 flex flex-wrap items-center justify-center gap-5 rounded-[1.3rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] bg-[linear-gradient(120deg,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_60%)] px-6 py-8 text-center", children: [
          /* @__PURE__ */ jsx("p", { className: "text-lg font-semibold text-[var(--bokmoo-ink)]", children: t({ en: "Ready to get started?", hans: "\u51C6\u5907\u597D\u5F00\u59CB\u4E86\u5417\uFF1F", hant: "\u6E96\u5099\u597D\u958B\u59CB\u4E86\u55CE\uFF1F" }) }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => openHref("/download/app"),
              className: "btn-shimmer inline-flex min-h-12 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[#141210]",
              type: "button",
              children: [
                t({ en: "Download the BOKMOO App", hans: "\u4E0B\u8F7D BOKMOO App", hant: "\u4E0B\u8F09 BOKMOO App" }),
                /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
              ]
            }
          )
        ] })
      ] }) })
    ] });
  });

  // src/components/LoginPage.tsx
  var FOCUS_VISIBLE_RING3 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function LoginPage({
    isLoading,
    error,
    config,
    onSubmit,
    onOAuthClick,
    onAppleOAuthClick,
    onNavigateToRegister,
    onNavigateToForgotPassword
  }) {
    const site = resolveBokmooSiteConfig(config);
    const [email, setEmail] = react_default.useState("");
    const [password, setPassword] = react_default.useState("");
    const [showPassword, setShowPassword] = react_default.useState(false);
    const emailRef = react_default.useRef(null);
    const passwordRef = react_default.useRef(null);
    const handleAutofill = (setter) => (event) => {
      if (event.animationName === "onAutoFillStart") {
        setter(event.currentTarget.value);
      }
    };
    const handleSubmit = async (event) => {
      event.preventDefault();
      const emailValue = emailRef.current?.value || email;
      const passwordValue = passwordRef.current?.value || password;
      if (!emailValue || !passwordValue) return;
      await onSubmit(emailValue, passwordValue);
    };
    return /* @__PURE__ */ jsxs("div", { className: "relative min-h-screen overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)] sm:px-6 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_24%),radial-gradient(circle_at_16%_78%,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_24%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_86%,black))]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.62fr)]", children: [
        /* @__PURE__ */ jsxs("section", { className: "hidden lg:block", children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)]", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
            "Secure account access"
          ] }),
          /* @__PURE__ */ jsx("h1", { className: "mt-7 max-w-3xl text-[clamp(3.5rem,7vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--bokmoo-ink)]", children: "Sign in before your next border." }),
          /* @__PURE__ */ jsx("p", { className: "mt-7 max-w-2xl text-lg leading-8 text-[var(--bokmoo-copy)]", children: "Manage BOKMOO eSIM profiles, orders, and activation details from the same black-and-gold travel control surface." }),
          /* @__PURE__ */ jsx("div", { className: "mt-10 grid max-w-2xl gap-3 sm:grid-cols-3", children: [
            ["Orders", "Track purchases"],
            ["Profiles", "Manage eSIMs"],
            ["Support", "Get help fast"]
          ].map(([title, body]) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "rounded-[1.15rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.07_0.008_75_/_0.76)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
              children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-[var(--bokmoo-gold)]", children: title }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--bokmoo-copy-soft)]", children: body })
              ]
            },
            title
          )) })
        ] }),
        /* @__PURE__ */ jsx("section", { className: "mx-auto w-full max-w-[30rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]", children: [
              site.brandName.toUpperCase(),
              " account"
            ] }),
            /* @__PURE__ */ jsx("h2", { className: "mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Welcome back" }),
            /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "Continue to your orders, profiles, and activation workspace." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 grid gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onOAuthClick("google"),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING3}`,
                disabled: isLoading,
                children: [
                  /* @__PURE__ */ jsx(Chrome, { className: "h-4 w-4" }),
                  "Google"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onAppleOAuthClick?.(),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING3}`,
                disabled: isLoading || !onAppleOAuthClick,
                children: [
                  /* @__PURE__ */ jsx(Apple, { className: "h-4 w-4" }),
                  "Apple"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", children: "or email" }),
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" })
          ] }),
          /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "mt-7 space-y-5", children: [
            error ? /* @__PURE__ */ jsx("div", { className: "rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_12%,transparent)] p-4 text-sm leading-6 text-[var(--bokmoo-ink)]", children: error }) : null,
            /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Email" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(Mail, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    ref: emailRef,
                    type: "email",
                    value: email,
                    onChange: (event) => setEmail(event.target.value),
                    onAnimationStart: handleAutofill(setEmail),
                    placeholder: "you@example.com",
                    className: `h-12 w-full rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_34%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_62%,#1a1720)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[color:color-mix(in_oklab,var(--bokmoo-copy)_80%,transparent)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING3}`,
                    disabled: isLoading,
                    autoComplete: "email"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Password" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    ref: passwordRef,
                    type: showPassword ? "text" : "password",
                    value: password,
                    onChange: (event) => setPassword(event.target.value),
                    onAnimationStart: handleAutofill(setPassword),
                    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                    className: `h-12 w-full rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] py-3 pl-11 pr-12 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING3}`,
                    disabled: isLoading,
                    autoComplete: "current-password"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setShowPassword((value) => !value),
                    className: `absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING3}`,
                    disabled: isLoading,
                    "aria-label": showPassword ? "Hide password" : "Show password",
                    children: showPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between gap-4", children: /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onNavigateToForgotPassword,
                className: `text-sm font-medium text-[var(--bokmoo-copy)] underline decoration-[var(--bokmoo-line)] underline-offset-4 hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING3}`,
                disabled: isLoading,
                children: "Forgot password"
              }
            ) }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                disabled: isLoading,
                className: `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING3}`,
                children: isLoading ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                  /* @__PURE__ */ jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
                  "Signing in"
                ] }) : "Sign in"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 border-t border-[var(--bokmoo-line)] pt-6 text-center", children: [
            /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: [
              "New to ",
              site.brandName.toUpperCase(),
              "?"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onNavigateToRegister,
                className: `mt-3 text-sm font-semibold text-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold-strong)] ${FOCUS_VISIBLE_RING3}`,
                disabled: isLoading,
                children: "Create account"
              }
            )
          ] })
        ] }) })
      ] })
    ] });
  }

  // src/components/InstallSessionPanel.tsx
  function copyToClipboard(value) {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => void 0);
  }
  function getQrImageSrc(value) {
    if (!value) return null;
    if (/^data:image\//i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    return null;
  }
  var InstallSessionPanel = react_default.memo(function InstallSessionPanel2({
    session,
    className = "",
    title = "Install Details"
  }) {
    const qrImageSrc = getQrImageSrc(session.qrCode);
    const qrPayload = session.qrCode || session.lpaString || "";
    const fields = [
      ["SM-DP+", session.smdpAddress || "\u2014"],
      ["Matching ID", session.matchingId || "\u2014"],
      ["Activation Code", session.activationCode || "\u2014"],
      ["Confirmation Code", session.confirmationCode || "\u2014"]
    ];
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: `rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4 text-left ${className}`,
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(QrCode, { className: "h-5 w-5" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: title }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: session.packageTitle })
            ] })
          ] }),
          qrPayload ? /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_52%),var(--bokmoo-bg-elevated)] p-4", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center", children: [
            /* @__PURE__ */ jsx("div", { className: "flex aspect-square items-center justify-center rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-3", children: qrImageSrc ? /* @__PURE__ */ jsx("img", { src: qrImageSrc, alt: "BOKMOO eSIM install QR code", className: "h-full w-full object-contain" }) : /* @__PURE__ */ jsxs("div", { className: "flex h-full w-full flex-col items-center justify-center gap-3 text-center text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsx(QrCode, { className: "h-11 w-11 text-[var(--bokmoo-gold)]" }),
              /* @__PURE__ */ jsx("span", { className: "text-xs leading-5", children: "QR payload ready" })
            ] }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: "Scan or install manually" }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--bokmoo-copy)]", children: "If the QR image is not provided by the backend, use the manual fields below or copy the LPA payload." }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => copyToClipboard(qrPayload),
                  className: "mt-4 inline-flex min-h-10 items-center gap-2 rounded-[0.8rem] border border-[var(--bokmoo-line)] px-4 text-sm font-medium text-[var(--bokmoo-ink)]",
                  type: "button",
                  children: [
                    /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                    "Copy QR Payload"
                  ]
                }
              )
            ] })
          ] }) }) : null,
          /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3 md:grid-cols-2", children: fields.map(([label, value]) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "flex items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3",
              children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: label }),
                  /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-ink)]", children: value })
                ] }),
                value !== "\u2014" ? /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => copyToClipboard(String(value)),
                    className: "text-[var(--bokmoo-gold)]",
                    type: "button",
                    children: /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4" })
                  }
                ) : null
              ]
            },
            `${label}-${value}`
          )) }),
          session.lpaString ? /* @__PURE__ */ jsx("div", { className: "mt-3 rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "LPA String" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 break-all text-sm text-[var(--bokmoo-ink)]", children: session.lpaString })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => copyToClipboard(session.lpaString || ""),
                className: "text-[var(--bokmoo-gold)]",
                type: "button",
                children: /* @__PURE__ */ jsx(Copy, { className: "h-4 w-4" })
              }
            )
          ] }) }) : null,
          session.instructions?.ios?.length || session.instructions?.android?.length || session.instructions?.general?.length ? /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-3", children: [
            session.instructions?.ios?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "iOS" }),
              /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]", children: session.instructions.ios.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) })
            ] }) : null,
            session.instructions?.android?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "Android" }),
              /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]", children: session.instructions.android.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) })
            ] }) : null,
            session.instructions?.general?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: "General Notes" }),
              /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]", children: session.instructions.general.map((item) => /* @__PURE__ */ jsx("li", { children: item }, item)) })
            ] }) : null
          ] }) : null,
          session.support?.email || session.support?.phone ? /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--bokmoo-copy)]", children: [
            session.support?.email ? /* @__PURE__ */ jsx("a", { className: "inline-flex items-center gap-2 text-[var(--bokmoo-ink)] underline", href: `mailto:${session.support.email}`, children: session.support.email }) : null,
            session.support?.phone ? /* @__PURE__ */ jsx("a", { className: "inline-flex items-center gap-2 text-[var(--bokmoo-ink)] underline", href: `tel:${session.support.phone}`, children: session.support.phone }) : null
          ] }) : null
        ]
      }
    );
  });

  // src/components/OrderDetailPage.tsx
  function copyToClipboard2(value) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => void 0);
  }
  function statusTone(status) {
    const normalized = status.toUpperCase();
    if (normalized === "DELIVERED" || normalized === "COMPLETED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-success)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "PENDING" || normalized === "PAID" || normalized === "PROCESSING") return "bg-[color:color-mix(in_oklab,var(--bokmoo-warning)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "CANCELLED" || normalized === "REFUNDED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_14%,white)] text-[var(--bokmoo-ink)]";
    return "bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary-strong)]";
  }
  function renderField(label, value, action) {
    return /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: label }),
        action
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 break-all text-sm font-semibold text-[var(--bokmoo-ink)]", children: value })
    ] });
  }
  var OrderDetailPage = react_default.memo(function OrderDetailPage2({
    order,
    isLoading,
    config,
    onBack,
    onBackToOrders,
    onCancelOrder
  }) {
    const handleBack = onBack || onBackToOrders;
    const site = resolveBokmooSiteConfig(config);
    const [remoteOrder, setRemoteOrder] = react_default.useState(null);
    const [installSession, setInstallSession] = react_default.useState(null);
    const effectiveOrder = order || remoteOrder;
    react_default.useEffect(() => {
      if (order?.id) return;
      const orderId2 = getOrderIdFromLocation();
      if (!orderId2) return;
      let cancelled = false;
      void getBokmooOrder(
        {
          baseUrl: site.apiBaseUrl
        },
        orderId2
      ).then((response) => {
        if (!cancelled) {
          setRemoteOrder(mapBokmooApiOrderToThemeOrder(response));
        }
      }).catch(() => void 0);
      return () => {
        cancelled = true;
      };
    }, [order?.id, site.apiBaseUrl]);
    react_default.useEffect(() => {
      if (!effectiveOrder?.id) return;
      let cancelled = false;
      void getBokmooInstallSession(
        {
          baseUrl: site.apiBaseUrl
        },
        effectiveOrder.id
      ).then((session) => {
        if (!cancelled) {
          setInstallSession(session);
        }
      }).catch(() => void 0);
      return () => {
        cancelled = true;
      };
    }, [effectiveOrder?.id, site.apiBaseUrl]);
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    if (!effectiveOrder) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-3xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Order not found" }),
        handleBack ? /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: handleBack,
            className: "mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--bokmoo-primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              "Back to orders"
            ]
          }
        ) : null
      ] }) });
    }
    const artifactCount = effectiveOrder.items.reduce(
      (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
      0
    );
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      handleBack ? /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: handleBack,
          className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back to orders"
          ]
        }
      ) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.7fr)]", children: [
        /* @__PURE__ */ jsxs("section", { className: "space-y-4", children: [
          /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: cn2("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]", statusTone(effectiveOrder.status)), children: effectiveOrder.status }),
                /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy)]", children: [
                  artifactCount,
                  " delivered item",
                  artifactCount === 1 ? "" : "s"
                ] })
              ] }),
              /* @__PURE__ */ jsxs("h1", { className: "mt-5 text-[clamp(2.2rem,4vw,4rem)] font-black tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: [
                "Order #",
                effectiveOrder.id.slice(-8).toUpperCase()
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: [
                "Created ",
                new Date(effectiveOrder.createdAt).toLocaleString(),
                " \xB7 payment ",
                effectiveOrder.paymentStatus
              ] })
            ] }),
            onCancelOrder && ["PENDING", "PAID"].includes(effectiveOrder.status.toUpperCase()) ? /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => onCancelOrder(),
                className: "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
                children: "Cancel order"
              }
            ) : null
          ] }) }),
          installSession ? /* @__PURE__ */ jsx(
            InstallSessionPanel,
            {
              title: "Install Session",
              session: installSession,
              className: "border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)]"
            }
          ) : null,
          effectiveOrder.shipments?.length ? /* @__PURE__ */ jsxs("section", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
              /* @__PURE__ */ jsx(PackageCheck, { className: "mt-1 h-5 w-5 shrink-0 text-[var(--bokmoo-primary)]" }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h2", { className: "text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Delivery tracking" }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "Your carrier and tracking updates appear here after dispatch." })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4", children: effectiveOrder.shipments.map((shipment) => /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: [
                    shipment.carrierName || shipment.carrier,
                    shipment.carrierCode ? ` \xB7 ${shipment.carrierCode}` : ""
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "mt-2 break-all font-mono text-sm font-semibold text-[var(--bokmoo-ink)]", children: shipment.trackingNumber })
                ] }),
                /* @__PURE__ */ jsx("span", { className: cn2("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", statusTone(shipment.status)), children: shipment.status })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--bokmoo-copy)]", children: [
                shipment.shippedAt ? /* @__PURE__ */ jsxs("span", { children: [
                  "Shipped ",
                  new Date(shipment.shippedAt).toLocaleDateString()
                ] }) : null,
                shipment.deliveredAt ? /* @__PURE__ */ jsxs("span", { children: [
                  "Delivered ",
                  new Date(shipment.deliveredAt).toLocaleDateString()
                ] }) : null,
                shipment.trackingUrl ? /* @__PURE__ */ jsxs("a", { href: shipment.trackingUrl, target: "_blank", rel: "noreferrer", className: "inline-flex items-center gap-1 font-semibold text-[var(--bokmoo-primary-strong)] underline underline-offset-4", children: [
                  "Track package ",
                  /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5" })
                ] }) : null
              ] }),
              shipment.events?.length ? /* @__PURE__ */ jsx("ol", { className: "mt-5 border-l border-[var(--bokmoo-line-strong)] pl-4", children: shipment.events.map((event, eventIndex) => /* @__PURE__ */ jsxs("li", { className: "relative pb-4 last:pb-0", children: [
                /* @__PURE__ */ jsx("span", { className: "absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--bokmoo-primary)] ring-4 ring-[var(--bokmoo-bg)]" }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-[var(--bokmoo-ink)]", children: event.status.replace(/_/g, " ") }),
                  /* @__PURE__ */ jsx("time", { className: "text-[11px] text-[var(--bokmoo-copy-soft)]", dateTime: event.occurredAt, children: new Date(event.occurredAt).toLocaleString() })
                ] }),
                event.description ? /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs leading-5 text-[var(--bokmoo-copy)]", children: event.description }) : null
              ] }, `${event.status}-${event.occurredAt}-${eventIndex}`)) }) : null
            ] }, shipment.id)) })
          ] }) : null,
          effectiveOrder.items.map((item) => {
            const sections3 = extractDeliverySections(item.fulfillmentData);
            const installLike = (() => {
              const data = item.fulfillmentData;
              if (!data || typeof data !== "object") return null;
              if (!("qrCode" in data || "qr_code" in data || "qrCodeContent" in data || "qr_code_content" in data || "lpaString" in data || "lpa" in data || "lpa_string" in data || "smdpAddress" in data || "smdp_address" in data || "smdp" in data || "matchingId" in data || "matching_id" in data || "activationCode" in data || "activation_code" in data)) {
                return null;
              }
              return normalizeInstallSession({
                ...data,
                orderId: effectiveOrder.id,
                orderNumber: effectiveOrder.id,
                status: "ready",
                packageTitle: item.productName
              });
            })();
            const hasContent = sections3.codes.length + sections3.credentials.length + sections3.links.length + sections3.meta.length + sections3.notes.length > 0;
            return /* @__PURE__ */ jsxs(
              "article",
              {
                className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: "Item delivery" }),
                      /* @__PURE__ */ jsx("h2", { className: "mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: item.productName }),
                      /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm text-[var(--bokmoo-copy)]", children: [
                        "Qty ",
                        item.quantity,
                        item.variantName ? ` \xB7 ${item.variantName}` : ""
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: cn2("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]", statusTone(item.fulfillmentStatus || effectiveOrder.status)), children: item.fulfillmentStatus || effectiveOrder.status })
                  ] }),
                  hasContent ? /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4", children: [
                    installLike ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: [
                      ["SM-DP+", installLike.smdpAddress || "\u2014"],
                      ["Matching ID", installLike.matchingId || "\u2014"],
                      ["Activation Code", installLike.activationCode || "\u2014"],
                      ["Confirmation Code", installLike.confirmationCode || "\u2014"]
                    ].map(([label, value]) => /* @__PURE__ */ jsx("div", { children: renderField(
                      label,
                      String(value),
                      value !== "\u2014" ? /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: () => copyToClipboard2(String(value)),
                          className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                          children: [
                            /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" }),
                            "Copy"
                          ]
                        }
                      ) : void 0
                    ) }, `${label}-${value}`)) }) : null,
                    sections3.codes.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: sections3.codes.map((field) => /* @__PURE__ */ jsx("div", { children: renderField(
                      field.label,
                      field.value,
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: () => copyToClipboard2(field.value),
                          className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                          children: [
                            /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" }),
                            "Copy"
                          ]
                        }
                      )
                    ) }, `${item.id}-${field.label}-${field.value}`)) }) : null,
                    sections3.credentials.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: sections3.credentials.map((field) => /* @__PURE__ */ jsx("div", { children: renderField(
                      field.label,
                      field.value,
                      /* @__PURE__ */ jsxs(
                        "button",
                        {
                          onClick: () => copyToClipboard2(field.value),
                          className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                          children: [
                            /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" }),
                            "Copy"
                          ]
                        }
                      )
                    ) }, `${item.id}-${field.label}-${field.value}`)) }) : null,
                    sections3.links.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3", children: sections3.links.map(
                      (field) => renderField(
                        field.label,
                        field.value,
                        /* @__PURE__ */ jsxs(
                          "a",
                          {
                            href: field.href,
                            target: "_blank",
                            rel: "noreferrer",
                            className: "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-primary)]",
                            children: [
                              /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5" }),
                              "Open"
                            ]
                          }
                        )
                      )
                    ) }) : null,
                    sections3.meta.length ? /* @__PURE__ */ jsx("div", { className: "grid gap-3 md:grid-cols-2", children: sections3.meta.map((field) => /* @__PURE__ */ jsx("div", { children: renderField(field.label, field.value) }, `${item.id}-${field.label}-${field.value}`)) }) : null,
                    sections3.notes.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5", children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: "Notes" }),
                      /* @__PURE__ */ jsx("div", { className: "mt-3 space-y-2", children: sections3.notes.map((note) => /* @__PURE__ */ jsx("p", { className: "text-sm leading-6 text-[var(--bokmoo-copy)]", children: note }, note)) })
                    ] }) : null
                  ] }) : /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-md)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "This order is still waiting for fulfillment details. Refresh later or reopen it from the order archive." })
                ]
              },
              item.id
            );
          })
        ] }),
        /* @__PURE__ */ jsxs("aside", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)]", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary)]", children: /* @__PURE__ */ jsx(PackageCheck, { className: "h-5 w-5" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Order total" }),
                /* @__PURE__ */ jsxs("p", { className: "mt-1 text-3xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                  "$",
                  Number(effectiveOrder.totalAmount || 0).toFixed(2)
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-3 text-sm text-[var(--bokmoo-copy)]", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { children: "Currency" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: effectiveOrder.currency })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { children: "Payment" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-[var(--bokmoo-ink)]", children: effectiveOrder.paymentStatus })
              ] }),
              effectiveOrder.cancelReason ? /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: "Cancel reason" }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-[var(--bokmoo-copy)]", children: effectiveOrder.cancelReason })
              ] }) : null
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)]", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary)]", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "h-5 w-5" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Access reminder" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "Keep a copy of any sensitive credentials in your own password manager or secure notes after claiming the order." })
            ] })
          ] }) })
        ] })
      ] })
    ] }) });
  });

  // src/components/OrdersPage.tsx
  function getStatusTone(status) {
    const normalized = status.toUpperCase();
    if (normalized === "DELIVERED" || normalized === "COMPLETED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-success)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "PENDING" || normalized === "PAID" || normalized === "PROCESSING") return "bg-[color:color-mix(in_oklab,var(--bokmoo-warning)_18%,white)] text-[var(--bokmoo-ink)]";
    if (normalized === "CANCELLED" || normalized === "REFUNDED") return "bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_14%,white)] text-[var(--bokmoo-ink)]";
    return "bg-[var(--bokmoo-primary-soft)] text-[var(--bokmoo-primary-strong)]";
  }
  var OrdersPage = react_default.memo(function OrdersPage2({
    orders,
    isLoading,
    error,
    currentPage,
    totalPages,
    config,
    onPageChange,
    onOrderClick,
    onCancelOrder,
    locale
  }) {
    const site = resolveBokmooSiteConfig(config);
    const t = (copy) => pickCopy(locale, copy);
    const statusLabels = {
      PENDING: { en: "Pending", hans: "\u5F85\u652F\u4ED8", hant: "\u5F85\u4ED8\u6B3E" },
      PAID: { en: "Paid", hans: "\u5DF2\u652F\u4ED8", hant: "\u5DF2\u4ED8\u6B3E" },
      PROCESSING: { en: "Processing", hans: "\u5904\u7406\u4E2D", hant: "\u8655\u7406\u4E2D" },
      DELIVERED: { en: "Delivered", hans: "\u5DF2\u4EA4\u4ED8", hant: "\u5DF2\u4EA4\u4ED8" },
      COMPLETED: { en: "Completed", hans: "\u5DF2\u5B8C\u6210", hant: "\u5DF2\u5B8C\u6210" },
      CANCELLED: { en: "Cancelled", hans: "\u5DF2\u53D6\u6D88", hant: "\u5DF2\u53D6\u6D88" },
      REFUNDED: { en: "Refunded", hans: "\u5DF2\u9000\u6B3E", hant: "\u5DF2\u9000\u6B3E" }
    };
    const statusText = (status) => {
      const key = status.toUpperCase();
      return statusLabels[key] ? t(statusLabels[key]) : status;
    };
    const [remoteOrders, setRemoteOrders] = react_default.useState([]);
    const [remoteTotalPages, setRemoteTotalPages] = react_default.useState(1);
    const [remoteLoading, setRemoteLoading] = react_default.useState(false);
    const [remoteError, setRemoteError] = react_default.useState("");
    react_default.useEffect(() => {
      if (orders.length > 0) return;
      let cancelled = false;
      setRemoteLoading(true);
      setRemoteError("");
      void getBokmooOrders(
        {
          baseUrl: site.apiBaseUrl
        },
        {
          page: currentPage || 1,
          limit: 10
        }
      ).then((response) => {
        if (cancelled) return;
        setRemoteOrders(response.items.map(mapBokmooApiOrderToThemeOrder));
        setRemoteTotalPages(Math.max(1, Math.ceil(Number(response.total || response.items.length || 0) / 10)));
      }).catch((loadError) => {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load orders.";
        setRemoteError(message);
        setRemoteOrders([]);
        setRemoteTotalPages(1);
      }).finally(() => {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [currentPage, orders.length, site.apiBaseUrl]);
    const effectiveOrders = remoteOrders.length > 0 ? remoteOrders : orders;
    const displayError = error || remoteError;
    const displayTotalPages = remoteOrders.length > 0 ? remoteTotalPages : totalPages;
    if (isLoading || remoteLoading && effectiveOrders.length === 0) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1280px]", children: [
      /* @__PURE__ */ jsx("section", { className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 text-[var(--bokmoo-primary)]" }),
            t({ en: "Order archive", hans: "\u8BA2\u5355\u6863\u6848", hant: "\u8A02\u55AE\u6A94\u6848" })
          ] }),
          /* @__PURE__ */ jsx("h1", { className: "mt-5 text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "Every purchase stays readable after checkout.", hans: "\u6BCF\u7B14\u8BA2\u5355\u5728\u7ED3\u7B97\u540E\u90FD\u53EF\u968F\u65F6\u56DE\u770B\u3002", hant: "\u6BCF\u7B46\u8A02\u55AE\u5728\u7D50\u5E33\u5F8C\u90FD\u53EF\u96A8\u6642\u56DE\u770B\u3002" }) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-sm text-[var(--bokmoo-copy)]", children: t({ en: "Keep status, delivery details, and activation notes visible after checkout.", hans: "\u7ED3\u7B97\u540E\u4ECD\u53EF\u67E5\u770B\u72B6\u6001\u3001\u914D\u9001\u8BE6\u60C5\u4E0E\u6FC0\u6D3B\u5907\u6CE8\u3002", hant: "\u7D50\u5E33\u5F8C\u4ECD\u53EF\u67E5\u770B\u72C0\u614B\u3001\u914D\u9001\u8A73\u60C5\u8207\u555F\u7528\u5099\u8A3B\u3002" }) })
      ] }) }),
      displayError ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-8 text-[var(--bokmoo-copy)] shadow-[var(--bokmoo-shadow)]", children: displayError }) : null,
      /* @__PURE__ */ jsx("section", { className: "mt-6 grid gap-4", children: effectiveOrders.length === 0 ? /* @__PURE__ */ jsx("div", { className: "rounded-[var(--bokmoo-radius-lg)] border border-dashed border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-16 text-center text-[var(--bokmoo-copy)]", children: t({ en: "No travel orders yet.", hans: "\u8FD8\u6CA1\u6709\u65C5\u884C\u8BA2\u5355\u3002", hant: "\u9084\u6C92\u6709\u65C5\u884C\u8A02\u55AE\u3002" }) }) : effectiveOrders.map((order) => {
        const artifactCount = order.items.reduce(
          (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
          0
        );
        const canCancel = Boolean(onCancelOrder) && ["PENDING", "PAID"].includes(order.status.toUpperCase());
        return /* @__PURE__ */ jsx(
          "article",
          {
            className: "rounded-[var(--bokmoo-radius-lg)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] p-5 shadow-[var(--bokmoo-shadow)]",
            children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: cn2("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]", getStatusTone(order.status)), children: statusText(order.status) }),
                  /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy)]", children: [
                    artifactCount,
                    " ",
                    t({ en: artifactCount === 1 ? "delivered item" : "delivered items", hans: "\u4E2A\u5DF2\u4EA4\u4ED8\u9879\u76EE", hant: "\u500B\u5DF2\u4EA4\u4ED8\u9805\u76EE" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("h2", { className: "mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                  t({ en: "Order", hans: "\u8BA2\u5355", hant: "\u8A02\u55AE" }),
                  " #",
                  order.id.slice(-8).toUpperCase()
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap gap-4 text-sm text-[var(--bokmoo-copy)]", children: [
                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx(Clock3, { className: "h-4 w-4" }),
                    new Date(order.createdAt).toLocaleString()
                  ] }),
                  /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx(Package2, { className: "h-4 w-4" }),
                    order.items.length,
                    " ",
                    t({ en: order.items.length === 1 ? "item" : "items", hans: "\u4EF6\u5546\u54C1", hant: "\u4EF6\u5546\u54C1" })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center", children: [
                /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 py-3 text-right", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: t({ en: "Total", hans: "\u603B\u8BA1", hant: "\u7E3D\u8A08" }) }),
                  /* @__PURE__ */ jsxs("p", { className: "mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: [
                    "$",
                    Number(order.totalAmount || 0).toFixed(2)
                  ] })
                ] }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => onOrderClick(order.id),
                    className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--bokmoo-primary)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white",
                    children: [
                      t({ en: "Open order", hans: "\u67E5\u770B\u8BA2\u5355", hant: "\u67E5\u770B\u8A02\u55AE" }),
                      /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
                    ]
                  }
                ),
                canCancel ? /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => onCancelOrder(order.id),
                    className: "inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
                    children: t({ en: "Cancel order", hans: "\u53D6\u6D88\u8BA2\u5355", hant: "\u53D6\u6D88\u8A02\u55AE" })
                  }
                ) : null
              ] })
            ] })
          },
          order.id
        );
      }) }),
      displayTotalPages > 1 ? /* @__PURE__ */ jsxs("div", { className: "mt-10 flex items-center justify-center gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.max(1, currentPage - 1)),
            disabled: currentPage <= 1,
            className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)] disabled:opacity-40",
            children: t({ en: "Previous", hans: "\u4E0A\u4E00\u9875", hant: "\u4E0A\u4E00\u9801" })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy)]", children: [
          t({ en: "Page", hans: "\u7B2C", hant: "\u7B2C" }),
          " ",
          currentPage,
          " / ",
          displayTotalPages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => onPageChange(Math.min(displayTotalPages, currentPage + 1)),
            disabled: currentPage >= displayTotalPages,
            className: "rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)] disabled:opacity-40",
            children: t({ en: "Next", hans: "\u4E0B\u4E00\u9875", hant: "\u4E0B\u4E00\u9801" })
          }
        )
      ] }) : null
    ] }) });
  });

  // src/components/OrderSuccessPage.tsx
  function copyToClipboard3(value) {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => void 0);
  }
  function getPollDelay(attempt) {
    if (attempt < 10) return 3e3;
    if (attempt < 22) return 1e4;
    return 0;
  }
  var OrderSuccessPage = react_default.memo(function OrderSuccessPage2({
    orderNumber,
    isVerifying,
    onContinueShopping,
    onViewOrders,
    config,
    order
  }) {
    const site = resolveBokmooSiteConfig(config);
    const orderId2 = order?.id || getOrderIdFromLocation() || "";
    const [installSession, setInstallSession] = react_default.useState(null);
    const [status, setStatus] = react_default.useState(
      isVerifying ? "processing" : "idle"
    );
    const [errorMessage, setErrorMessage] = react_default.useState("");
    const [attempt, setAttempt] = react_default.useState(0);
    const [orderKind, setOrderKind] = react_default.useState(
      orderId2 ? "checking" : "esim"
    );
    react_default.useEffect(() => {
      if (!orderId2) return;
      let cancelled = false;
      void (async () => {
        try {
          const detail = await getBokmooOrder({ baseUrl: site.apiBaseUrl }, orderId2);
          if (cancelled) return;
          const items = detail.items || [];
          const hasEsim = items.some((item) => item.productKind === "esim");
          setOrderKind(hasEsim || items.length === 0 ? "esim" : "physical");
        } catch {
          if (!cancelled) setOrderKind("esim");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [orderId2, site.apiBaseUrl]);
    const loadInstallSession = react_default.useCallback(async () => {
      if (!orderId2 || orderKind !== "esim") return;
      try {
        const session = await getBokmooInstallSession(
          {
            baseUrl: site.apiBaseUrl
          },
          orderId2
        );
        setInstallSession(session);
        setStatus(session.status);
        setErrorMessage("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load install session.";
        setErrorMessage(message);
        setStatus("failed");
      }
    }, [orderId2, site.apiBaseUrl]);
    react_default.useEffect(() => {
      if (!orderId2) return;
      void loadInstallSession();
    }, [loadInstallSession, orderId2]);
    react_default.useEffect(() => {
      if (!orderId2 || orderKind !== "esim") return;
      if (status !== "processing" && status !== "idle") return;
      const delay2 = getPollDelay(attempt);
      if (delay2 <= 0) {
        setErrorMessage("Fulfillment is taking longer than expected. Please refresh or contact support.");
        return;
      }
      const timer = window.setTimeout(() => {
        setAttempt((current) => current + 1);
        void loadInstallSession();
      }, delay2);
      return () => window.clearTimeout(timer);
    }, [attempt, loadInstallSession, orderId2, orderKind, status]);
    const isReady = status === "ready" || status === "installed";
    const isPendingPayment = status === "pending_payment";
    const supportEmail = installSession?.support?.email || site.supportEmail;
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-[520px]", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 text-center shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: orderKind === "physical" ? status === "failed" ? /* @__PURE__ */ jsx(TriangleAlert, { className: "h-11 w-11" }) : /* @__PURE__ */ jsx(Package, { className: "h-10 w-10" }) : status === "failed" || status === "expired" || isPendingPayment ? /* @__PURE__ */ jsx(TriangleAlert, { className: "h-11 w-11" }) : status === "processing" || isVerifying ? /* @__PURE__ */ jsx(LoaderCircle, { className: "h-11 w-11 animate-spin" }) : /* @__PURE__ */ jsx(CircleCheck, { className: "h-11 w-11" }) }),
      /* @__PURE__ */ jsx("h1", { className: "mt-8 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: orderKind === "physical" ? status === "failed" ? "Fulfillment Needs Attention" : isPendingPayment ? "Payment Pending" : "Your card is being prepared for shipment" : status === "failed" ? "Fulfillment Needs Attention" : isPendingPayment ? "Payment Pending" : status === "expired" ? "Activation Expired" : status === "processing" || isVerifying ? "Preparing your eSIM..." : "Payment Successful!" }),
      /* @__PURE__ */ jsx("p", { className: "mt-4 text-base leading-8 text-[var(--bokmoo-copy)]", children: orderKind === "physical" ? status === "failed" ? errorMessage || "We could not prepare your shipment yet." : isPendingPayment ? "Complete payment and we will start preparing your card for delivery." : "Your order is paid. We are packing your Bokmoo Card now \u2014 you will get a shipping confirmation with tracking, and it should arrive within a few business days." : status === "failed" ? errorMessage || "We could not prepare your install session yet." : isPendingPayment ? "Complete payment to unlock your eSIM install details." : status === "expired" ? "Your activation session expired before installation completed." : status === "processing" || isVerifying ? "Your order is paid. We are preparing the install session now." : "Your eSIM is ready to use." }),
      installSession?.packageTitle ? /* @__PURE__ */ jsx("div", { className: "mx-auto mt-8 max-w-[320px] rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4 text-left", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: "h-16 w-20 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: installSession.packageTitle }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: installSession.smdpAddress || "eSIM activation" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: installSession.expiresAt ? `Expires ${new Date(installSession.expiresAt).toLocaleDateString()}` : "Ready to install" })
        ] })
      ] }) }) : null,
      isReady && installSession ? /* @__PURE__ */ jsx(InstallSessionPanel, { className: "mt-8", session: installSession }) : null,
      /* @__PURE__ */ jsxs("div", { className: "mt-8 space-y-3", children: [
        orderKind === "physical" ? /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onViewOrders,
            className: "flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]",
            type: "button",
            children: "Track Your Order"
          }
        ) : /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: isReady ? onViewOrders : () => void loadInstallSession(),
            className: "flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]",
            type: "button",
            children: [
              isReady ? "View eSIM Details" : "Refresh Status",
              !isReady ? /* @__PURE__ */ jsx(RefreshCw, { className: "h-4 w-4" }) : null
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onContinueShopping,
            className: "flex min-h-12 w-full items-center justify-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-5 text-sm font-medium text-[var(--bokmoo-ink)]",
            type: "button",
            children: "Back to Store"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-2 text-sm text-[var(--bokmoo-copy-soft)]", children: [
        /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] px-4 py-2", children: [
          "Order reference",
          /* @__PURE__ */ jsx("code", { className: "font-semibold text-[var(--bokmoo-ink)]", children: orderNumber }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => copyToClipboard3(orderNumber),
              className: "text-[var(--bokmoo-gold)]",
              type: "button",
              children: /* @__PURE__ */ jsx(Copy, { className: "h-3.5 w-3.5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Support: ",
          /* @__PURE__ */ jsx("a", { className: "text-[var(--bokmoo-ink)] underline", href: `mailto:${supportEmail}`, children: supportEmail })
        ] })
      ] })
    ] }) }) });
  });

  // src/components/PrivacyPage.tsx
  var sections = [
    {
      en: { title: "Information We Collect", body: "We collect information you provide directly to us, such as when you create an account or make a purchase." },
      hans: { title: "\u6211\u4EEC\u6536\u96C6\u7684\u4FE1\u606F", body: "\u6211\u4EEC\u6536\u96C6\u4F60\u76F4\u63A5\u63D0\u4F9B\u7684\u4FE1\u606F\uFF0C\u4F8B\u5982\u521B\u5EFA\u8D26\u6237\u6216\u8D2D\u4E70\u65F6\u63D0\u4F9B\u7684\u4FE1\u606F\u3002" },
      hant: { title: "\u6211\u5011\u6536\u96C6\u7684\u8CC7\u8A0A", body: "\u6211\u5011\u6536\u96C6\u4F60\u76F4\u63A5\u63D0\u4F9B\u7684\u8CC7\u8A0A\uFF0C\u4F8B\u5982\u5EFA\u7ACB\u5E33\u6236\u6216\u8CFC\u8CB7\u6642\u63D0\u4F9B\u7684\u8CC7\u8A0A\u3002" }
    },
    {
      en: { title: "How We Use Information", body: "We use the information to provide, maintain, and improve our services." },
      hans: { title: "\u6211\u4EEC\u5982\u4F55\u4F7F\u7528\u4FE1\u606F", body: "\u6211\u4EEC\u4F7F\u7528\u8FD9\u4E9B\u4FE1\u606F\u6765\u63D0\u4F9B\u3001\u7EF4\u62A4\u548C\u6539\u8FDB\u6211\u4EEC\u7684\u670D\u52A1\u3002" },
      hant: { title: "\u6211\u5011\u5982\u4F55\u4F7F\u7528\u8CC7\u8A0A", body: "\u6211\u5011\u4F7F\u7528\u9019\u4E9B\u8CC7\u8A0A\u4F86\u63D0\u4F9B\u3001\u7DAD\u8B77\u548C\u6539\u9032\u6211\u5011\u7684\u670D\u52D9\u3002" }
    },
    {
      en: { title: "Data Protection", body: "We implement appropriate security measures to protect your data." },
      hans: { title: "\u6570\u636E\u4FDD\u62A4", body: "\u6211\u4EEC\u91C7\u53D6\u9002\u5F53\u7684\u5B89\u5168\u63AA\u65BD\u6765\u4FDD\u62A4\u4F60\u7684\u6570\u636E\u3002" },
      hant: { title: "\u8CC7\u6599\u4FDD\u8B77", body: "\u6211\u5011\u63A1\u53D6\u9069\u7576\u7684\u5B89\u5168\u63AA\u65BD\u4F86\u4FDD\u8B77\u4F60\u7684\u8CC7\u6599\u3002" }
    },
    {
      en: { title: "Your Rights", body: "You have the right to access, update, or delete your personal information." },
      hans: { title: "\u4F60\u7684\u6743\u5229", body: "\u4F60\u6709\u6743\u8BBF\u95EE\u3001\u66F4\u65B0\u6216\u5220\u9664\u4F60\u7684\u4E2A\u4EBA\u4FE1\u606F\u3002" },
      hant: { title: "\u4F60\u7684\u6B0A\u5229", body: "\u4F60\u6709\u6B0A\u5B58\u53D6\u3001\u66F4\u65B0\u6216\u522A\u9664\u4F60\u7684\u500B\u4EBA\u8CC7\u8A0A\u3002" }
    }
  ];
  var PrivacyPage = react_default.memo(function PrivacyPage2({ locale }) {
    const t = (copy) => pickCopy(locale, copy);
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "Privacy Policy", hans: "\u9690\u79C1\u653F\u7B56", hant: "\u96B1\u79C1\u653F\u7B56" }) }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[var(--bokmoo-copy-soft)]", children: "Last updated: April 15, 2024" }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 space-y-5", children: sections.map((section, index) => {
        const copy = locale === "zh-Hans" ? section.hans : locale === "zh-Hant" ? section.hant : section.en;
        return /* @__PURE__ */ jsxs(
          "section",
          {
            className: "rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5",
            children: [
              /* @__PURE__ */ jsxs("p", { className: "text-base font-medium text-[var(--bokmoo-ink)]", children: [
                index + 1,
                ". ",
                copy.title
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]", children: copy.body })
            ]
          },
          section.en.title
        );
      }) })
    ] }) });
  });

  // src/components/ProfileSettingsPage.tsx
  var ProfileSettingsPage = react_default.memo(function ProfileSettingsPage2({
    user,
    isLoading,
    isAuthenticated,
    onSaveProfile,
    onChangePassword,
    onNavigateBack,
    onNavigateToLogin
  }) {
    const [profile, setProfile] = react_default.useState({
      name: user?.name || "",
      phone: user?.phone || "",
      dateOfBirth: user?.dateOfBirth || "",
      gender: user?.gender || "OTHER",
      preferredLanguage: user?.preferredLanguage || "en",
      timezone: user?.timezone || "UTC"
    });
    const [password, setPassword] = react_default.useState({
      currentPassword: "",
      newPassword: ""
    });
    const [savingProfile, setSavingProfile] = react_default.useState(false);
    const [savingPassword, setSavingPassword] = react_default.useState(false);
    react_default.useEffect(() => {
      setProfile({
        name: user?.name || "",
        phone: user?.phone || "",
        dateOfBirth: user?.dateOfBirth || "",
        gender: user?.gender || "OTHER",
        preferredLanguage: user?.preferredLanguage || "en",
        timezone: user?.timezone || "UTC"
      });
    }, [user]);
    if (isLoading) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    if (!isAuthenticated || !user) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Sign in to manage your account" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onNavigateToLogin,
            className: "mt-6 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
            type: "button",
            children: "Log In"
          }
        )
      ] }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[1080px]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onNavigateBack,
          className: "inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            "Back"
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("section", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(UserRound, { className: "h-6 w-6" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Traveler profile" }),
              /* @__PURE__ */ jsx("h1", { className: "mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Keep your BOKMOO account ready for the next trip." })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2 sm:col-span-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Email" }),
              /* @__PURE__ */ jsx("input", { value: user.email, readOnly: true, className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-copy)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2 sm:col-span-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Name" }),
              /* @__PURE__ */ jsx("input", { value: profile.name, onChange: (event) => setProfile((prev) => ({ ...prev, name: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Phone" }),
              /* @__PURE__ */ jsx("input", { value: profile.phone, onChange: (event) => setProfile((prev) => ({ ...prev, phone: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Date of birth" }),
              /* @__PURE__ */ jsx("input", { value: profile.dateOfBirth, onChange: (event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Language" }),
              /* @__PURE__ */ jsx("input", { value: profile.preferredLanguage, onChange: (event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Timezone" }),
              /* @__PURE__ */ jsx("input", { value: profile.timezone, onChange: (event) => setProfile((prev) => ({ ...prev, timezone: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: async () => {
                setSavingProfile(true);
                try {
                  await onSaveProfile(profile);
                } finally {
                  setSavingProfile(false);
                }
              },
              className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]",
              disabled: savingProfile,
              type: "button",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
                savingProfile ? "Saving..." : "Save profile"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(LockKeyhole, { className: "h-6 w-6" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Password" }),
              /* @__PURE__ */ jsx("h2", { className: "mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: "Keep access secure between trips." })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4", children: [
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Current password" }),
              /* @__PURE__ */ jsx("input", { type: "password", value: password.currentPassword, onChange: (event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "grid gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "New password" }),
              /* @__PURE__ */ jsx("input", { type: "password", value: password.newPassword, onChange: (event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value })), className: "h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: async () => {
                setSavingPassword(true);
                try {
                  await onChangePassword(password.currentPassword, password.newPassword);
                  setPassword({ currentPassword: "", newPassword: "" });
                } finally {
                  setSavingPassword(false);
                }
              },
              className: "mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-ink)]",
              disabled: savingPassword,
              type: "button",
              children: [
                /* @__PURE__ */ jsx(LockKeyhole, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
                savingPassword ? "Updating..." : "Change password"
              ]
            }
          )
        ] })
      ] })
    ] }) });
  });

  // src/components/RegisterPage.tsx
  var FOCUS_VISIBLE_RING4 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]";
  function RegisterPage({
    isLoading,
    error,
    config,
    onSubmit,
    onOAuthClick,
    onAppleOAuthClick,
    onNavigateToLogin
  }) {
    const site = resolveBokmooSiteConfig(config);
    const [formData, setFormData] = react_default.useState({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: ""
    });
    const [showPassword, setShowPassword] = react_default.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = react_default.useState(false);
    const passwordsMatch = formData.password === formData.confirmPassword;
    const canSubmit = formData.firstName && formData.lastName && formData.email && formData.password && formData.confirmPassword && passwordsMatch;
    const updateField = (field) => (event) => setFormData((current) => ({ ...current, [field]: event.target.value }));
    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!canSubmit) return;
      await onSubmit(formData);
    };
    const inputClassName = `h-12 w-full rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_34%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_62%,#1a1720)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--bokmoo-ink)] outline-none placeholder:text-[color:color-mix(in_oklab,var(--bokmoo-copy)_80%,transparent)] transition-colors focus:border-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING4}`;
    return /* @__PURE__ */ jsxs("div", { className: "relative min-h-screen overflow-hidden bg-[var(--bokmoo-bg)] px-4 py-12 text-[var(--bokmoo-ink)] sm:px-6 lg:px-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "pointer-events-none absolute inset-0", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,color-mix(in_oklab,var(--bokmoo-gold)_18%,transparent),transparent_25%),radial-gradient(circle_at_12%_76%,color-mix(in_oklab,var(--bokmoo-gold)_8%,transparent),transparent_26%),linear-gradient(180deg,var(--bokmoo-bg),color-mix(in_oklab,var(--bokmoo-bg)_86%,black))]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 opacity-40 [background-image:var(--bokmoo-grid)] [background-size:72px_72px]" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(24rem,0.68fr)]", children: [
        /* @__PURE__ */ jsxs("section", { className: "hidden lg:block", children: [
          /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)] bg-[color:oklch(0.065_0.007_75_/_0.72)] px-5 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--bokmoo-gold)]", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4" }),
            "Protected traveler identity"
          ] }),
          /* @__PURE__ */ jsx("h1", { className: "mt-7 max-w-3xl text-[clamp(3.4rem,7vw,6.1rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-[var(--bokmoo-ink)]", children: "Create the account your eSIMs follow." }),
          /* @__PURE__ */ jsx("p", { className: "mt-7 max-w-2xl text-lg leading-8 text-[var(--bokmoo-copy)]", children: "Keep orders, activation codes, profile history, and support cases attached to one BOKMOO identity." })
        ] }),
        /* @__PURE__ */ jsx("section", { className: "mx-auto w-full max-w-[32rem] rounded-[1.45rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_94%,white),var(--bokmoo-bg-elevated))] p-5 shadow-[var(--bokmoo-shadow)] sm:p-7", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[color:oklch(0.055_0.006_75_/_0.78)] p-5 sm:p-6", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--bokmoo-gold)]", children: [
            site.brandName.toUpperCase(),
            " account"
          ] }),
          /* @__PURE__ */ jsx("h2", { className: "mt-3 text-3xl font-semibold leading-none tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: "Create account" }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--bokmoo-copy)]", children: "Start with a secure profile for purchases and global activation support." }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 grid gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onOAuthClick("google"),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING4}`,
                disabled: isLoading,
                children: [
                  /* @__PURE__ */ jsx(Chrome, { className: "h-4 w-4" }),
                  "Google"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onAppleOAuthClick?.(),
                className: `inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING4}`,
                disabled: isLoading || !onAppleOAuthClick,
                children: [
                  /* @__PURE__ */ jsx(Apple, { className: "h-4 w-4" }),
                  "Apple"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-6 flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]", children: "or email" }),
            /* @__PURE__ */ jsx("div", { className: "h-px flex-1 bg-[var(--bokmoo-line)]" })
          ] }),
          /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "mt-7 space-y-5", children: [
            error ? /* @__PURE__ */ jsx("div", { className: "rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_12%,transparent)] p-4 text-sm leading-6 text-[var(--bokmoo-ink)]", children: error }) : null,
            /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: ["firstName", "lastName"].map((field) => /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: field === "firstName" ? "First name" : "Last name" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(UserRound, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    value: formData[field],
                    onChange: updateField(field),
                    placeholder: field === "firstName" ? "Ada" : "Lovelace",
                    className: inputClassName,
                    disabled: isLoading,
                    autoComplete: field === "firstName" ? "given-name" : "family-name"
                  }
                )
              ] })
            ] }, field)) }),
            /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Email" }),
              /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                /* @__PURE__ */ jsx(Mail, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "email",
                    value: formData.email,
                    onChange: updateField("email"),
                    placeholder: "you@example.com",
                    className: inputClassName,
                    disabled: isLoading,
                    autoComplete: "email"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
              /* @__PURE__ */ jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Password" }),
                /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                  /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: showPassword ? "text" : "password",
                      value: formData.password,
                      onChange: updateField("password"),
                      placeholder: "........",
                      className: `${inputClassName} pr-12`,
                      disabled: isLoading,
                      autoComplete: "new-password"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setShowPassword((value) => !value),
                      className: `absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING4}`,
                      disabled: isLoading,
                      "aria-label": showPassword ? "Hide password" : "Show password",
                      children: showPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Confirm" }),
                /* @__PURE__ */ jsxs("span", { className: "relative mt-2 block", children: [
                  /* @__PURE__ */ jsx(LockKeyhole, { className: "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bokmoo-copy-soft)]" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: showConfirmPassword ? "text" : "password",
                      value: formData.confirmPassword,
                      onChange: updateField("confirmPassword"),
                      placeholder: "........",
                      className: `${inputClassName} pr-12 ${formData.confirmPassword && !passwordsMatch ? "border-[var(--bokmoo-danger)]" : ""}`,
                      disabled: isLoading,
                      autoComplete: "new-password"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setShowConfirmPassword((value) => !value),
                      className: `absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[0.8rem] text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-gold)] ${FOCUS_VISIBLE_RING4}`,
                      disabled: isLoading,
                      "aria-label": showConfirmPassword ? "Hide password" : "Show password",
                      children: showConfirmPassword ? /* @__PURE__ */ jsx(EyeOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" })
                    }
                  )
                ] }),
                formData.confirmPassword && !passwordsMatch ? /* @__PURE__ */ jsx("span", { className: "mt-2 block text-xs text-[var(--bokmoo-danger)]", children: "Passwords do not match" }) : null
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "submit",
                disabled: isLoading || !canSubmit,
                className: `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_88%,white),color-mix(in_oklab,var(--bokmoo-gold)_64%,black))] px-5 text-sm font-black uppercase tracking-[0.2em] text-[var(--bokmoo-bg)] shadow-[0_18px_42px_color-mix(in_oklab,var(--bokmoo-gold)_16%,transparent)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_VISIBLE_RING4}`,
                children: isLoading ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                  /* @__PURE__ */ jsx(LoaderCircle, { className: "h-4 w-4 animate-spin" }),
                  "Creating"
                ] }) : "Create account"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-7 border-t border-[var(--bokmoo-line)] pt-6 text-center", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]", children: "Already have an account?" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onNavigateToLogin,
                className: `mt-3 text-sm font-semibold text-[var(--bokmoo-gold)] hover:text-[var(--bokmoo-gold-strong)] ${FOCUS_VISIBLE_RING4}`,
                disabled: isLoading,
                children: "Sign in"
              }
            )
          ] })
        ] }) })
      ] })
    ] });
  }

  // src/components/ProductDetailPage.tsx
  function getProductImage2(product) {
    if (!product?.images?.length) return null;
    const primary = product.images.find((image) => image.isMain) || product.images[0];
    return primary?.url || null;
  }
  function getVariantLabel(variant) {
    return variant.name || variant.value || variant.sku || "Default option";
  }
  var ProductDetailPage = react_default.memo(function ProductDetailPage2({
    product,
    isLoading,
    selectedVariant,
    quantity,
    onVariantChange,
    onQuantityChange,
    onAddToCart,
    onNavigateToCheckout,
    onBack,
    config,
    locale
  }) {
    const site = resolveBokmooSiteConfig(config);
    const [remoteProduct, setRemoteProduct] = react_default.useState(null);
    const [remoteLoading, setRemoteLoading] = react_default.useState(false);
    const normalizedProduct = react_default.useMemo(
      () => product ? normalizeProductForTheme(product) : remoteProduct,
      [product, remoteProduct]
    );
    const profile = react_default.useMemo(() => getBokmooTravelProfile(normalizedProduct), [normalizedProduct]);
    const isGoodsProduct = normalizedProduct?.productKind === "goods";
    const isBluetoothCard = isGoodsProduct && /bluetooth|蓝牙/i.test(normalizedProduct?.description || "");
    const goodsSubtitle = isBluetoothCard ? { en: "Physical Bluetooth card \u2014 manage multiple eSIM profiles with the BOKMOO app", hans: "\u5B9E\u4F53\u84DD\u7259\u5361\uFF0C\u642D\u914D BOKMOO App \u7BA1\u7406\u591A\u4E2A eSIM \u5957\u9910", hant: "\u5BE6\u9AD4\u85CD\u7259\u5361\uFF0C\u642D\u914D BOKMOO App \u7BA1\u7406\u591A\u500B eSIM \u8A2D\u5B9A\u6A94" } : { en: "Physical card \u2014 works with the BOKMOO app", hans: "\u5B9E\u4F53\u5361\uFF0C\u642D\u914D BOKMOO App \u4F7F\u7528", hant: "\u5BE6\u9AD4\u5361\uFF0C\u642D\u914D BOKMOO App \u4F7F\u7528" };
    const goodsSpecCards = isBluetoothCard ? [
      { label: pickCopy(locale, { en: "Type", hans: "\u7C7B\u578B", hant: "\u985E\u578B" }), value: pickCopy(locale, { en: "Physical eSIM card", hans: "eSIM \u5B9E\u4F53\u5361", hant: "eSIM \u5BE6\u9AD4\u5361" }) },
      { label: pickCopy(locale, { en: "Connection", hans: "\u8FDE\u63A5", hant: "\u9023\u7DDA" }), value: pickCopy(locale, { en: "Bluetooth", hans: "\u84DD\u7259", hant: "\u85CD\u7259" }) },
      { label: pickCopy(locale, { en: "Management", hans: "\u7BA1\u7406", hant: "\u7BA1\u7406" }), value: "BOKMOO App" }
    ] : [
      { label: pickCopy(locale, { en: "Type", hans: "\u7C7B\u578B", hant: "\u985E\u578B" }), value: pickCopy(locale, { en: "Physical card", hans: "\u5B9E\u4F53\u5361", hant: "\u5BE6\u9AD4\u5361" }) },
      { label: pickCopy(locale, { en: "Compatibility", hans: "\u517C\u5BB9", hant: "\u76F8\u5BB9" }), value: "iPhone / Android" },
      { label: pickCopy(locale, { en: "Management", hans: "\u7BA1\u7406", hant: "\u7BA1\u7406" }), value: "BOKMOO App" }
    ];
    const goodsBullets = isBluetoothCard ? [
      { en: "Manage multiple eSIM profiles over Bluetooth", hans: "\u901A\u8FC7\u84DD\u7259\u7BA1\u7406\u591A\u4E2A eSIM \u5957\u9910", hant: "\u900F\u904E\u85CD\u7259\u7BA1\u7406\u591A\u500B eSIM \u8A2D\u5B9A\u6A94" },
      { en: "Set up and switch profiles in the BOKMOO app", hans: "\u5728 BOKMOO App \u5185\u542F\u7528\u4E0E\u5207\u6362\u5957\u9910", hant: "\u5728 BOKMOO App \u5167\u555F\u7528\u8207\u5207\u63DB\u8A2D\u5B9A\u6A94" }
    ] : [
      { en: "Works with the BOKMOO app", hans: "\u642D\u914D BOKMOO App \u4F7F\u7528", hant: "\u642D\u914D BOKMOO App \u4F7F\u7528" }
    ];
    const goodsSetupLabel = pickCopy(locale, { en: "Setup", hans: "\u4F7F\u7528\u65B9\u5F0F", hant: "\u4F7F\u7528\u65B9\u5F0F" });
    const goodsSetupValue = isBluetoothCard ? pickCopy(locale, { en: "Connects to the BOKMOO app over Bluetooth", hans: "\u84DD\u7259\u8FDE\u63A5 BOKMOO App \u7BA1\u7406", hant: "\u85CD\u7259\u9023\u7DDA BOKMOO App \u7BA1\u7406" }) : pickCopy(locale, { en: "Works with the BOKMOO app", hans: "\u642D\u914D BOKMOO App \u4F7F\u7528", hant: "\u642D\u914D BOKMOO App \u4F7F\u7528" });
    react_default.useEffect(() => {
      if (!normalizedProduct?.name) return;
      document.title = `${normalizedProduct.name} | ${site.brandName}`;
    }, [normalizedProduct?.name, site.brandName]);
    const effectiveSelectedVariant = selectedVariant || normalizedProduct?.variants?.[0]?.id || null;
    const currentVariant = react_default.useMemo(() => {
      if (!normalizedProduct?.variants?.length || !effectiveSelectedVariant) return null;
      return normalizedProduct.variants.find((variant) => variant.id === effectiveSelectedVariant) || null;
    }, [effectiveSelectedVariant, normalizedProduct]);
    const stockValue = Number(currentVariant?.inventory ?? normalizedProduct?.inventory?.available ?? 0);
    const priceValue = Number(currentVariant?.price ?? normalizedProduct?.price ?? 0);
    const maxQuantity = Math.max(1, Math.min(stockValue || 1, 10));
    const image = resolveBokmooMediaUrl(getProductImage2(normalizedProduct), site.apiBaseUrl);
    const [adding, setAdding] = react_default.useState(false);
    const [justAdded, setJustAdded] = react_default.useState(false);
    const addedTimer = react_default.useRef(null);
    react_default.useEffect(() => () => {
      if (addedTimer.current) window.clearTimeout(addedTimer.current);
    }, []);
    const handleAddToCart = react_default.useCallback(async () => {
      if (adding) return;
      setAdding(true);
      try {
        await onAddToCart();
        setJustAdded(true);
        if (addedTimer.current) window.clearTimeout(addedTimer.current);
        addedTimer.current = window.setTimeout(() => setJustAdded(false), 2200);
      } finally {
        setAdding(false);
      }
    }, [adding, onAddToCart]);
    const handleBuyNow = react_default.useCallback(async () => {
      if (adding) return;
      setAdding(true);
      try {
        await onAddToCart();
        onNavigateToCheckout?.();
      } finally {
        setAdding(false);
      }
    }, [adding, onAddToCart, onNavigateToCheckout]);
    react_default.useEffect(() => {
      if (product) return;
      const productId = getProductIdFromLocation();
      if (!productId) return;
      let cancelled = false;
      setRemoteLoading(true);
      void getBokmooProduct(
        {
          baseUrl: site.apiBaseUrl
        },
        productId,
        locale || "en"
      ).then((response) => {
        if (!cancelled) {
          setRemoteProduct(mapBokmooApiProductToThemeProduct(response));
        }
      }).catch(() => void 0).finally(() => {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [locale, product, site.apiBaseUrl]);
    react_default.useEffect(() => {
      if (selectedVariant || !normalizedProduct?.variants?.length) return;
      onVariantChange(normalizedProduct.variants[0].id);
    }, [normalizedProduct?.variants, onVariantChange, selectedVariant]);
    if (isLoading || remoteLoading && !normalizedProduct) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)]" });
    }
    if (!normalizedProduct) {
      return /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4", children: /* @__PURE__ */ jsxs("div", { className: "rounded-[1.5rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-3xl font-semibold tracking-[-0.04em] text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Plan not found", hans: "\u672A\u627E\u5230\u5957\u9910", hant: "\u672A\u627E\u5230\u5957\u9910" }) }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: onBack,
            className: "mt-6 inline-flex min-h-11 items-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]",
            type: "button",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
              pickCopy(locale, { en: "Back to store", hans: "\u8FD4\u56DE\u5546\u5E97", hant: "\u8FD4\u56DE\u5546\u5E97" })
            ]
          }
        )
      ] }) });
    }
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px]", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onBack,
          className: "inline-flex items-center gap-2 text-sm text-[var(--bokmoo-copy-soft)] hover:text-[var(--bokmoo-ink)]",
          type: "button",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4" }),
            pickCopy(locale, { en: "Back to Store", hans: "\u8FD4\u56DE\u5546\u5E97", hant: "\u8FD4\u56DE\u5546\u5E97" })
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "mt-5 rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-3 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.55rem] sm:p-5", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,0.96fr)_22rem]", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-[1.05rem] border border-[var(--bokmoo-line)] sm:rounded-[1.2rem]", children: image ? /* @__PURE__ */ jsx("img", { src: image, alt: normalizedProduct.name, className: "aspect-[1.28/1] h-full w-full object-cover sm:aspect-[1.6/1]" }) : /* @__PURE__ */ jsx("div", { className: "aspect-[1.28/1] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)] sm:aspect-[1.6/1]" }) }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h1", { className: "text-[clamp(2.1rem,3.2vw,2.65rem)] font-semibold leading-[1.08] tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: normalizedProduct.name }),
              /* @__PURE__ */ jsx("p", { className: "mt-2 text-lg text-[var(--bokmoo-copy)]", children: isGoodsProduct ? pickCopy(locale, goodsSubtitle) : profile.networkLabel })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "sm:text-right", children: /* @__PURE__ */ jsxs("p", { className: "text-[2.3rem] font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]", children: [
              "$",
              priceValue.toFixed(2)
            ] }) })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 grid gap-3 sm:grid-cols-3", children: (isGoodsProduct ? goodsSpecCards : [
            { label: pickCopy(locale, { en: "Data", hans: "\u6570\u636E", hant: "\u6578\u64DA" }), value: profile.planLabel },
            { label: pickCopy(locale, { en: "Validity", hans: "\u6709\u6548\u671F", hant: "\u6709\u6548\u671F" }), value: profile.durationLabel },
            { label: pickCopy(locale, { en: "Network", hans: "\u7F51\u7EDC", hant: "\u7DB2\u8DEF" }), value: profile.networkLabel }
          ]).map((item) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-4",
              children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--bokmoo-copy-soft)]", children: item.label }),
                /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm font-medium text-[var(--bokmoo-ink)]", children: item.value })
              ]
            },
            item.label
          )) }),
          /* @__PURE__ */ jsx("div", { className: "mt-6 space-y-3", children: (isGoodsProduct ? goodsBullets : [
            { en: "High-speed 4G/5G data", hans: "\u9AD8\u901F 4G/5G \u6570\u636E", hant: "\u9AD8\u901F 4G/5G \u6578\u64DA" },
            { en: "Stay connected in major cities and more", hans: "\u4E3B\u8981\u57CE\u5E02\u53CA\u66F4\u591A\u5730\u533A\u4FDD\u6301\u8FDE\u63A5", hant: "\u4E3B\u8981\u57CE\u5E02\u53CA\u66F4\u591A\u5730\u5340\u4FDD\u6301\u9023\u7DDA" },
            { en: "No roaming charges", hans: "\u65E0\u6F2B\u6E38\u8D39\u7528", hant: "\u7121\u6F2B\u904A\u8CBB\u7528" }
          ]).map((item) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-sm text-[var(--bokmoo-copy)]", children: [
            /* @__PURE__ */ jsx(Check, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
            /* @__PURE__ */ jsx("span", { children: pickCopy(locale, item) })
          ] }, item.en)) }),
          !isGoodsProduct ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Coverage", hans: "\u8986\u76D6\u8303\u56F4", hant: "\u8986\u84CB\u7BC4\u570D" }) }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-[var(--bokmoo-copy-soft)]", children: profile.coverageLabel })
            ] }),
            /* @__PURE__ */ jsx("button", { className: "text-sm text-[var(--bokmoo-gold)]", type: "button", children: pickCopy(locale, { en: "View Details", hans: "\u67E5\u770B\u8BE6\u60C5", hant: "\u67E5\u770B\u8A73\u60C5" }) })
          ] }) }) : null
        ] }),
        /* @__PURE__ */ jsxs("aside", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Quick Facts", hans: "\u5FEB\u901F\u4FE1\u606F", hant: "\u5FEB\u901F\u8CC7\u8A0A" }) }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3", children: [
              {
                icon: Signal,
                label: isGoodsProduct ? goodsSetupLabel : pickCopy(locale, { en: "Activation", hans: "\u6FC0\u6D3B\u65B9\u5F0F", hant: "\u555F\u7528\u65B9\u5F0F" }),
                value: isGoodsProduct ? goodsSetupValue : pickCopy(locale, { en: "Instant via QR", hans: "\u626B\u7801\u5373\u65F6\u6FC0\u6D3B", hant: "\u6383\u78BC\u5373\u6642\u555F\u7528" })
              },
              { icon: Smartphone, label: pickCopy(locale, { en: "Compatibility", hans: "\u8BBE\u5907\u517C\u5BB9", hant: "\u88DD\u7F6E\u76F8\u5BB9" }), value: profile.compatibilityLabel },
              { icon: ShieldCheck, label: pickCopy(locale, { en: "Support", hans: "\u652F\u6301", hant: "\u652F\u63F4" }), value: pickCopy(locale, { en: "24/7 Global Team", hans: "24/7 \u5168\u7403\u56E2\u961F", hant: "24/7 \u5168\u7403\u5718\u968A" }) }
            ].map(({ icon: Icon2, label, value }) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
              /* @__PURE__ */ jsx("div", { className: "mt-0.5 flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]", children: /* @__PURE__ */ jsx(Icon2, { className: "h-4 w-4" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]", children: label }),
                /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-[var(--bokmoo-ink)]", children: value })
              ] })
            ] }, label)) })
          ] }),
          normalizedProduct.variants?.length ? /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Choose an option", hans: "\u9009\u62E9\u9009\u9879", hant: "\u9078\u64C7\u9078\u9805" }) }),
            /* @__PURE__ */ jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: normalizedProduct.variants.map((variant) => {
              const isActive = effectiveSelectedVariant === variant.id;
              return /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onVariantChange(variant.id),
                  className: cn2(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    isActive ? "border-[var(--bokmoo-line-strong)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-ink)]" : "border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]"
                  ),
                  type: "button",
                  children: getVariantLabel(variant)
                },
                variant.id
              );
            }) })
          ] }) : null,
          /* @__PURE__ */ jsxs("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[var(--bokmoo-ink)]", children: pickCopy(locale, { en: "Quantity", hans: "\u6570\u91CF", hant: "\u6578\u91CF" }) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_86%,black)] px-3 py-2", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onQuantityChange(Math.max(1, quantity - 1)),
                  className: "flex h-9 w-9 items-center justify-center rounded-full text-[var(--bokmoo-copy)]",
                  type: "button",
                  children: /* @__PURE__ */ jsx(Minus, { className: "h-4 w-4" })
                }
              ),
              /* @__PURE__ */ jsx("span", { className: "text-lg font-semibold text-[var(--bokmoo-ink)]", children: quantity }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onQuantityChange(Math.min(maxQuantity, quantity + 1)),
                  className: "flex h-9 w-9 items-center justify-center rounded-full text-[var(--bokmoo-copy)]",
                  type: "button",
                  children: /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleAddToCart,
              disabled: stockValue <= 0 || adding,
              className: `btn-shimmer flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] px-5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${justAdded ? "scale-[1.02] bg-[#1f7a3d] text-white" : "bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-[var(--bokmoo-bg)]"}`,
              type: "button",
              children: justAdded ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx(Check, { className: "h-4 w-4" }),
                pickCopy(locale, { en: `Added to cart \u2014 $${priceValue.toFixed(2)}`, hans: `\u5DF2\u52A0\u5165\u8D2D\u7269\u8F66 \u2014 $${priceValue.toFixed(2)}`, hant: `\u5DF2\u52A0\u5165\u8CFC\u7269\u8ECA \u2014 $${priceValue.toFixed(2)}` })
              ] }) : adding ? /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4 animate-pulse" }),
                pickCopy(locale, { en: "Adding\u2026", hans: "\u6DFB\u52A0\u4E2D\u2026", hant: "\u6DFB\u52A0\u4E2D\u2026" })
              ] }) : /* @__PURE__ */ jsxs(Fragment2, { children: [
                /* @__PURE__ */ jsx(ShoppingBag, { className: "h-4 w-4" }),
                pickCopy(locale, { en: `Add to Cart \u2014 $${priceValue.toFixed(2)}`, hans: `\u52A0\u5165\u8D2D\u7269\u8F66 \u2014 $${priceValue.toFixed(2)}`, hant: `\u52A0\u5165\u8CFC\u7269\u8ECA \u2014 $${priceValue.toFixed(2)}` })
              ] })
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: handleBuyNow,
              disabled: stockValue <= 0 || adding,
              className: "btn-shimmer flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_32%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-5 text-sm font-semibold text-[var(--bokmoo-ink)] transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_52%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
              type: "button",
              children: [
                pickCopy(locale, { en: "Buy Now", hans: "\u7ACB\u5373\u8D2D\u4E70", hant: "\u7ACB\u5373\u8CFC\u8CB7" }),
                /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm text-[var(--bokmoo-copy)]", children: [
            /* @__PURE__ */ jsx(Star, { className: "h-4 w-4 text-[var(--bokmoo-gold)]" }),
            isGoodsProduct ? pickCopy(locale, { en: "Official BOKMOO product", hans: "BOKMOO \u5B98\u65B9\u51FA\u54C1", hant: "BOKMOO \u5B98\u65B9\u51FA\u54C1" }) : pickCopy(locale, { en: "4.9 average traveler satisfaction", hans: "4.9 \u65C5\u884C\u8005\u5E73\u5747\u6EE1\u610F\u5EA6", hant: "4.9 \u65C5\u4EBA\u5E73\u5747\u6EFF\u610F\u5EA6" })
          ] }) })
        ] })
      ] }) })
    ] }) });
  });

  // src/components/TermsPage.tsx
  var sections2 = [
    {
      en: { title: "Acceptance of Terms", body: "By accessing or using the BOKMOO website and services, you agree to be bound by these Terms of Service." },
      hans: { title: "\u63A5\u53D7\u6761\u6B3E", body: "\u8BBF\u95EE\u6216\u4F7F\u7528 BOKMOO \u7F51\u7AD9\u4E0E\u670D\u52A1\uFF0C\u5373\u8868\u793A\u4F60\u540C\u610F\u672C\u670D\u52A1\u6761\u6B3E\u3002" },
      hant: { title: "\u63A5\u53D7\u689D\u6B3E", body: "\u8A2A\u554F\u6216\u4F7F\u7528 BOKMOO \u7DB2\u7AD9\u8207\u670D\u52D9\uFF0C\u5373\u8868\u793A\u4F60\u540C\u610F\u672C\u670D\u52D9\u689D\u6B3E\u3002" }
    },
    {
      en: { title: "Use of Services", body: "You agree to use our services only for lawful purposes and in accordance with these Terms." },
      hans: { title: "\u4F7F\u7528\u670D\u52A1", body: "\u4F60\u540C\u610F\u4EC5\u51FA\u4E8E\u5408\u6CD5\u76EE\u7684\u4F7F\u7528\u6211\u4EEC\u7684\u670D\u52A1\uFF0C\u5E76\u9075\u5B88\u672C\u6761\u6B3E\u3002" },
      hant: { title: "\u4F7F\u7528\u670D\u52D9", body: "\u4F60\u540C\u610F\u50C5\u51FA\u65BC\u5408\u6CD5\u76EE\u7684\u4F7F\u7528\u6211\u5011\u7684\u670D\u52D9\uFF0C\u4E26\u9075\u5B88\u672C\u689D\u6B3E\u3002" }
    },
    {
      en: { title: "Purchases and Payments", body: "All payments are final and non-refundable unless required by law." },
      hans: { title: "\u8D2D\u4E70\u4E0E\u652F\u4ED8", body: "\u9664\u975E\u6CD5\u5F8B\u8981\u6C42\uFF0C\u6240\u6709\u4ED8\u6B3E\u5747\u4E3A\u6700\u7EC8\u4ED8\u6B3E\uFF0C\u4E0D\u4E88\u9000\u6B3E\u3002" },
      hant: { title: "\u8CFC\u8CB7\u8207\u652F\u4ED8", body: "\u9664\u975E\u6CD5\u5F8B\u8981\u6C42\uFF0C\u6240\u6709\u4ED8\u6B3E\u5747\u70BA\u6700\u7D42\u4ED8\u6B3E\uFF0C\u4E0D\u4E88\u9000\u6B3E\u3002" }
    },
    {
      en: { title: "Limitation of Liability", body: "BOKMOO is not liable for any indirect, incidental, or consequential damages." },
      hans: { title: "\u8D23\u4EFB\u9650\u5236", body: "BOKMOO \u5BF9\u4EFB\u4F55\u95F4\u63A5\u3001\u9644\u5E26\u6216\u540E\u679C\u6027\u635F\u5BB3\u4E0D\u627F\u62C5\u8D23\u4EFB\u3002" },
      hant: { title: "\u8CAC\u4EFB\u9650\u5236", body: "BOKMOO \u5C0D\u4EFB\u4F55\u9593\u63A5\u3001\u9644\u5E36\u6216\u5F8C\u679C\u6027\u640D\u5BB3\u4E0D\u627F\u64D4\u8CAC\u4EFB\u3002" }
    }
  ];
  var TermsPage = react_default.memo(function TermsPage2({ locale }) {
    const t = (copy) => pickCopy(locale, copy);
    return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]", children: t({ en: "Terms of Service", hans: "\u670D\u52A1\u6761\u6B3E", hant: "\u670D\u52D9\u689D\u6B3E" }) }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-[var(--bokmoo-copy-soft)]", children: "Last updated: April 15, 2024" }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 space-y-5", children: sections2.map((section, index) => {
        const copy = locale === "zh-Hans" ? section.hans : locale === "zh-Hant" ? section.hant : section.en;
        return /* @__PURE__ */ jsxs(
          "section",
          {
            className: "rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5",
            children: [
              /* @__PURE__ */ jsxs("p", { className: "text-base font-medium text-[var(--bokmoo-ink)]", children: [
                index + 1,
                ". ",
                copy.title
              ] }),
              /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]", children: copy.body })
            ]
          },
          section.en.title
        );
      }) })
    ] }) });
  });

  // src/runtime.ts
  var theme = {
    components: {
      HomePage,
      ProductsPage,
      ProductDetailPage,
      CartPage,
      CheckoutPage,
      NotFound,
      BestsellersPage,
      NewArrivalsPage,
      CategoriesPage,
      SearchPage,
      OrdersPage,
      OrderDetailPage,
      OrderSuccessPage,
      OrderCancelledPage,
      ProfilePage,
      ProfileSettingsPage,
      AffiliatePage,
      ContactPage,
      HelpPage,
      PrivacyPage,
      TermsPage,
      DownloadAppPage,
      DealsPage,
      LoginPage,
      RegisterPage,
      AuthCallbackPage,
      Header,
      Footer
    },
    defaultConfig: {
      brand: {
        name: "BOKMOO",
        primaryColor: "#d7b23d",
        secondaryColor: "#11100d",
        fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
      },
      layout: {
        headerSticky: true,
        showFooterLinks: true,
        maxWidth: "1280px"
      },
      features: {
        showWishlist: false,
        showRatings: false,
        enableQuickView: false
      },
      site: {
        archetype: "storefront",
        eyebrow: "BOKMOO eSIM Card",
        headline: "One Card.\nGlobal Connection.",
        subheadline: "Use multiple eSIM profiles on your BOKMOO card. Stay connected in 200+ countries.",
        primaryCtaLabel: "Shop eSIM Plans",
        primaryCtaHref: "/products",
        secondaryCtaLabel: "How it works",
        secondaryCtaHref: "/#how-it-works",
        demoHref: "/products",
        docsHref: "/help",
        supportEmail: "support@bokmoo.com"
      }
    }
  };
  var runtime_default = theme;

  // bokmoo-theme-runtime-entry.ts
  var tokenStyleId = "bokmoo-runtime-tokens";
  var tokenStyle = document.getElementById(tokenStyleId);
  if (!tokenStyle) {
    tokenStyle = document.createElement("style");
    tokenStyle.id = tokenStyleId;
    document.head.appendChild(tokenStyle);
  }
  tokenStyle.textContent = `:root {
  --bokmoo-bg: oklch(0.055 0.006 75);
  --bokmoo-bg-elevated: oklch(0.082 0.008 75);
  --bokmoo-bg-soft: oklch(0.118 0.01 75);
  --bokmoo-panel: oklch(0.095 0.009 75 / 0.96);
  --bokmoo-panel-strong: oklch(0.14 0.013 75 / 0.98);
  --bokmoo-surface: var(--bokmoo-bg-elevated);
  --bokmoo-surface-alt: var(--bokmoo-bg-soft);
  --bokmoo-ink: oklch(0.97 0.006 86);
  --bokmoo-copy: oklch(0.78 0.011 82);
  --bokmoo-copy-soft: oklch(0.57 0.01 82);
  --bokmoo-line: oklch(0.29 0.019 78 / 0.34);
  --bokmoo-line-strong: oklch(0.52 0.034 78 / 0.52);
  --bokmoo-gold: oklch(0.76 0.105 80);
  --bokmoo-gold-strong: oklch(0.86 0.11 82);
  --bokmoo-gold-soft: oklch(0.2 0.042 79);
  --bokmoo-primary: var(--bokmoo-gold);
  --bokmoo-primary-strong: var(--bokmoo-gold-strong);
  --bokmoo-primary-soft: var(--bokmoo-gold-soft);
  --bokmoo-silver: oklch(0.86 0.01 255);
  --bokmoo-success: oklch(0.77 0.09 150);
  --bokmoo-warning: oklch(0.81 0.1 82);
  --bokmoo-danger: oklch(0.66 0.19 28);
  --bokmoo-shadow: 0 34px 110px -48px rgba(0, 0, 0, 0.92);
  --bokmoo-shadow-glow: 0 0 58px color-mix(in oklab, var(--bokmoo-gold) 30%, transparent);
  --bokmoo-orbit-glow: radial-gradient(circle, color-mix(in oklab, var(--bokmoo-gold) 54%, transparent) 0%, transparent 68%);
  --bokmoo-hero-gold-field: color-mix(in oklab, var(--bokmoo-gold) 42%, transparent);
  --bokmoo-card-edge: color-mix(in oklab, var(--bokmoo-gold) 52%, transparent);
  --bokmoo-card-glow: 0 64px 180px rgba(0, 0, 0, 0.82), 0 0 90px color-mix(in oklab, var(--bokmoo-gold) 18%, transparent);
  --bokmoo-radius-xl: 2rem;
  --bokmoo-radius-lg: 1.5rem;
  --bokmoo-radius-md: 1rem;
  --bokmoo-radius-sm: 0.75rem;
  --bokmoo-display: "Avenir Next", "Satoshi", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  --bokmoo-sans: "Avenir Next", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  --bokmoo-grid:
    linear-gradient(to right, color-mix(in oklab, var(--bokmoo-line) 72%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklab, var(--bokmoo-line) 72%, transparent) 1px, transparent 1px);

  /* Compatibility aliases for reused shared components */
  --vault-bg: var(--bokmoo-bg);
  --vault-surface: var(--bokmoo-bg-elevated);
  --vault-surface-alt: var(--bokmoo-bg-soft);
  --vault-ink: var(--bokmoo-ink);
  --vault-copy: var(--bokmoo-copy);
  --vault-copy-soft: var(--bokmoo-copy-soft);
  --vault-line: var(--bokmoo-line);
  --vault-primary: var(--bokmoo-gold);
  --vault-primary-strong: var(--bokmoo-gold-strong);
  --vault-primary-soft: var(--bokmoo-gold-soft);
  --vault-accent: var(--bokmoo-silver);
  --vault-success: var(--bokmoo-success);
  --vault-warning: var(--bokmoo-warning);
  --vault-danger: var(--bokmoo-danger);
  --vault-shadow: var(--bokmoo-shadow);
  --vault-radius-lg: var(--bokmoo-radius-lg);
  --vault-radius-md: var(--bokmoo-radius-md);
  --vault-radius-sm: var(--bokmoo-radius-sm);
  --vault-grid: var(--bokmoo-grid);
}

/*
 * Global element rules are scoped under body[data-theme='bokmoo'] so the
 * statically-bundled copy cannot restyle OTHER storefronts (the registry
 * imports every embedded theme's runtime, tokens included). The root
 * layout renders data-theme from the active store theme slug.
 */
body[data-theme='bokmoo'] {
  background:
    radial-gradient(circle at 82% 8%, color-mix(in oklab, var(--bokmoo-gold) 13%, transparent), transparent 18%),
    radial-gradient(circle at 75% 28%, color-mix(in oklab, var(--bokmoo-gold) 8%, transparent), transparent 24%),
    radial-gradient(circle at 20% 80%, color-mix(in oklab, var(--bokmoo-gold) 4%, transparent), transparent 22%),
    var(--bokmoo-bg);
  color: var(--bokmoo-ink);
  font-family: var(--bokmoo-sans);
  letter-spacing: 0.01em;
}

body[data-theme='bokmoo'] :is(h1, h2, h3, h4, h5, h6) {
  font-family: var(--bokmoo-display);
  font-weight: 700;
}

body[data-theme='bokmoo'] ::selection {
  background: color-mix(in oklab, var(--bokmoo-gold) 38%, transparent);
  color: var(--bokmoo-ink);
}

/* Cart badge pulse on add-to-cart */
@keyframes cart-pulse {
  0% { transform: scale(1); }
  35% { transform: scale(1.5); }
  70% { transform: scale(0.92); }
  100% { transform: scale(1); }
}
.cart-pulse { animation: cart-pulse 0.9s ease-in-out; }

/* Gold shimmer sweep on button hover (\u6D41\u5149) */
@keyframes gold-sweep {
  0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
  25% { opacity: 1; }
  100% { transform: translateX(240%) skewX(-18deg); opacity: 0; }
}
.btn-shimmer { position: relative; overflow: hidden; isolation: isolate; }
.btn-shimmer::after {
  content: '';
  position: absolute;
  top: -20%;
  bottom: -20%;
  left: 0;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255, 244, 214, 0.55), transparent);
  transform: translateX(-130%) skewX(-18deg);
  opacity: 0;
  pointer-events: none;
}
.btn-shimmer:hover::after { animation: gold-sweep 0.9s ease; }
`;
  var existingMeta = runtime_default && typeof runtime_default === "object" && runtime_default.meta && typeof runtime_default.meta === "object" ? runtime_default.meta : {};
  window.__JIFFOO_THEME_RUNTIME__ = {
    ...runtime_default,
    meta: {
      ...existingMeta,
      slug: "bokmoo",
      version: "1.1.32",
      target: "shop"
    }
  };
})();

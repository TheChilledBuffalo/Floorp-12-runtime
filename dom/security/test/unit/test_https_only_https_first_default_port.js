const { HttpServer } = ChromeUtils.importESModule(
  "resource://testing-common/httpd.sys.mjs"
);
const { NetUtil } = ChromeUtils.importESModule(
  "resource://gre/modules/NetUtil.sys.mjs"
);

const TEST_PATH = "/https_only_https_first_port";
var httpserver = null;
var channel = null;
var curTest = null;

const TESTS = [
  {
    description: "Test 1 - Default Port (scheme: http, port: default)",
    url: "http://test1.example.com",
    expectedScheme: "https",
    expectedPort: -1, // -1 == default
  },
  {
    description: "Test 2 - Explicit Default Port (scheme: http, port: 80)",
    url: "http://test1.example.com:80",
    expectedScheme: "https",
    expectedPort: -1, // -1 == default
  },
  {
    description: "Test 3 - Explicit Custom Port without upgrading",
    url: "http://test1.example.com:8888",
    expectedScheme: "http",
    expectedPort: 8888,
    upgradeCustomPort: false,
  },
  {
    description: "Test 4 - Explicit Custom Port with upgrading",
    url: "http://test1.example.com:8888",
    expectedScheme: "https",
    expectedPort: 8888,
    upgradeCustomPort: true,
  },
  {
    description:
      "Test 5 - Explicit Default Port for https (scheme: https, port: 443)",
    url: "https://test1.example.com:443",
    expectedScheme: "https",
    expectedPort: -1, // -1 == default
  },
];

function ChannelListener() {}

ChannelListener.prototype = {
  onStartRequest() {
    // dummy implementation
  },
  onDataAvailable() {
    do_throw("Should not get any data!");
  },
  onStopRequest(request) {
    var chan = request.QueryInterface(Ci.nsIChannel);
    let requestURL = chan.URI;
    Assert.equal(
      requestURL.scheme,
      curTest.expectedScheme,
      curTest.description
    );
    Assert.equal(requestURL.port, curTest.expectedPort, curTest.description);
    Assert.equal(requestURL.host, "test1.example.com", curTest.description);
    run_next_test();
  },
};

function setUpPrefs() {
  // set up the required prefs
  Services.prefs.setBoolPref("dom.security.https_first", true);
  Services.prefs.setBoolPref("dom.security.https_only_mode", false);
}

function setUpChannel() {
  var chan = NetUtil.newChannel({
    uri: curTest.url + TEST_PATH,
    loadingPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    contentPolicyType: Ci.nsIContentPolicy.TYPE_DOCUMENT,
    securityFlags: Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_SEC_CONTEXT_IS_NULL,
  });
  chan.QueryInterface(Ci.nsIHttpChannel);
  chan.requestMethod = "GET";
  return chan;
}

function serverHandler() {
  // dummy implementation
}

function run_next_test() {
  curTest = TESTS.shift();
  if (!curTest) {
    httpserver.stop(do_test_finished);
    Services.prefs.clearUserPref("dom.security.https_first_for_custom_ports");
    return;
  }

  if (typeof curTest.upgradeCustomPort === "boolean") {
    Services.prefs.setBoolPref(
      "dom.security.https_first_for_custom_ports",
      curTest.upgradeCustomPort
    );
  } else {
    Services.prefs.clearUserPref("dom.security.https_first_for_custom_ports");
  }

  channel = setUpChannel();
  channel.asyncOpen(new ChannelListener());
}

function run_test() {
  do_get_profile();
  do_test_pending();

  // set up the test environment
  httpserver = new HttpServer();
  httpserver.registerPathHandler(TEST_PATH, serverHandler);
  httpserver.start(-1);

  // set up prefs
  setUpPrefs();

  // run the tests
  run_next_test();
}

module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "jquery": true
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly",
        "Util": "readonly",
        "Twitch": "readonly",
        "TwitchClient": "readonly",
        "TwitchEvent": "readonly",
        "TwitchChatEvent": "readonly",
        "TwitchSubEvent": "readonly",
        "LoggerUtility": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "no-unused-vars": "warn",
        "no-shadow": "warn",
        "no-trailing-spaces": "warn",
        "eqeqeq": "warn"
    },
    "overrides": [
        {
            "files": ["utility.js"],
            "rules": {
                "no-console": "off"
            }
        }
    ]
};


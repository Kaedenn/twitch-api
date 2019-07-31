
SRCS = client.js utility.js
DIST = dist
DISTS = $(patsubst %,$(DIST)/%,$(SRCS))
ASSETS = assets/tinycolor.js
TESTS = test/util.js test/client.js

# Programs
LN = ln -s
CP = cp
MKDIR = mkdir
ESLINT = npx eslint
BABEL = npx babel
MOCHA = npx mocha

.PHONY: all lint test $(TESTS)

all: lint $(DISTS) $(ASSETS) test

lint:
	$(ESLINT) --env browser --env es6 $(SRCS)
	$(ESLINT) --env node $(TESTS)

$(DIST)/%.js: %.js
	if [ \! -d "$(DIST)" ]; then $(MKDIR) $(DIST); fi
	$(BABEL) --presets babel-preset-env $< -d $(DIST)/

assets/tinycolor.js: node_modules/tinycolor2/tinycolor.js
	$(CP) -f $< $@

test:
	$(MOCHA) --require test/harness.js

test/util.js:
	$(MOCHA) --require test/harness.js $@

test/client.js:
	$(MOCHA) --require test/harness.js $@

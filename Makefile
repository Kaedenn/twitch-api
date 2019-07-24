
SRCS = client.js utility.js
DIST = dist
DISTS = $(patsubst %,$(DIST)/%,$(SRCS))
TESTS = test/util.js test/client.js

.PHONY: all lint test

all: lint $(DISTS)

lint:
	npx eslint --env browser --env es6 $(SRCS)
	npx eslint --env node $(TESTS)

$(DIST)/%.js: %.js
	test -d dist || mkdir dist
	npx babel --presets babel-preset-env $< -d dist/

test:
	./node_modules/mocha/bin/mocha --require test/harness.js

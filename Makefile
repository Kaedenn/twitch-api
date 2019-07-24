
SRCS = client.js utility.js
DIST = dist
DISTS = $(patsubst %,$(DIST)/%,$(SRCS))

.PHONY: all lint test

all: lint $(DISTS)

lint:
	npx eslint --env browser --env es6 $(SRCS)

$(DIST)/%.js: %.js
	test -d dist || mkdir dist
	npx babel --presets babel-preset-env $< -d dist/

test:
	./node_modules/mocha/bin/mocha --require test/harness.js

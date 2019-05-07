
SRCS = $(wildcard *.js)
DIST = dist
DISTS = $(patsubst %,$(DIST)/%,$(SRCS))

.PHONY: all lint dist-list

all: lint dist dist-lint

lint:
	npx eslint --env browser --env es6 *.js

dist: $(DISTS)

dist/%.js: %.js
	test -d dist || mkdir dist
	npx babel --presets babel-preset-env $< -d dist/

dist-lint: dist
	npx eslint --env browser $(DISTS)


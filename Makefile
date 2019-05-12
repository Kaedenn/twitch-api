
SRCS = $(wildcard *.js)
DIST = dist
DISTS = $(patsubst %,$(DIST)/%,$(SRCS))

.PHONY: all lint

all: lint dist

lint:
	npx eslint --env browser --env es6 $(SRCS)

dist: $(DISTS)

dist/%.js: %.js
	test -d dist || mkdir dist
	npx babel --presets babel-preset-env $< -d dist/


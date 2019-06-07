
SRCS = client.js utility.js
EXTRAS = math.js
DIST = dist
DISTS = $(patsubst %,$(DIST)/%,$(SRCS)) $(patsubst %,$(DIST)/%,$(EXTRAS))

.PHONY: all lint

all: lint $(EXTRAS) $(DISTS)

lint:
	npx eslint --env browser --env es6 $(SRCS)

math.js: node_modules/mathjs/dist/math.js
	cp $< $@

$(DIST)/math.js: node_modules/mathjs/dist/math.min.js
	cp $< $@

$(DIST)/%.js: %.js
	test -d dist || mkdir dist
	npx babel --presets babel-preset-env $< -d dist/



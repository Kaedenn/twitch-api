
.PHONY: all lint babel dist-lint

all: lint

lint:
	npx eslint --env browser --env es6 *.js

dist-lint:
	npx eslint --env browser --env es6 dist/*.js

babel:
	npx babel --presets babel-preset-es2015 client.js -d dist/
	npx babel --presets babel-preset-es2015 utility.js -d dist/
	npx babel --presets babel-preset-es2015 twitch-utility.js -d dist/
	npx babel --presets babel-preset-es2015 colors.js -d dist/

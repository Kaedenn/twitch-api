# Wrap common operations supporting the Twitch API library.
#
# 1) Check the sources for mistakes and errors via eslint
# 2) dist-ify the sources for cross-browser support
# 3) Generate assets (specifically, tinycolor)
# 4) Run tests, unless NOTEST is given:
#   make NOTEST=1
#
# To run certain tests, specify "test_<case>", eg.:
#   make test_util              # Run only util.js test suite

SOURCES := client.js utility.js
DIST := dist
DISTS := $(patsubst %,$(DIST)/%,$(SOURCES))
ASSETS := assets/tinycolor.js

TEST_DIR := test
TEST_HARNESS := $(TEST_DIR)/harness/main.js
TEST_CASES := $(patsubst $(TEST_DIR)/%.js,%,$(wildcard $(TEST_DIR)/*.js))
TEST_SOURCES := $(wildcard $(TEST_DIR)/*.js) $(wildcard $(TEST_DIR)/harness/*.js)

# Populated below by TEMPLATE_test
TESTS :=

# Programs
LN := ln -s
CP := cp
MKDIR := mkdir
ESLINT := npx eslint
BABEL := npx babel
MOCHA := npx mocha

.PHONY: all lint babel test

all: lint babel $(ASSETS)
ifeq ($(NOTEST),)
all: test
endif

# Define case rule and add "test_<case>" to $(TESTS) variable
define TEMPLATE_test =
.PHONY: test_$(1)
TESTS += test_$(1)
test_$(1):
	$(MOCHA) --require $(TEST_HARNESS) $(TEST_DIR)/$(1).js
endef

$(foreach case,$(TEST_CASES),$(eval $(call TEMPLATE_test,$(case))))

lint:
	$(ESLINT) --env browser --env es6 $(SOURCES)
	$(ESLINT) --env node $(TEST_SOURCES)

babel: $(DISTS)

$(DIST)/%.js: %.js
	if [ \! -d "$(DIST)" ]; then $(MKDIR) $(DIST); fi
	$(BABEL) --presets babel-preset-env $< -d $(DIST)/

assets/tinycolor.js: node_modules/tinycolor2/tinycolor.js
	$(CP) -f $< $@

test:
	$(MOCHA) --require $(TEST_HARNESS)

print-% : ; $(info $* is a $(flavor $*) variable set to [$($*)]) @true


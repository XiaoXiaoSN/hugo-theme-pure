/**
 * Insight search plugin
 * @author PPOffice { @link https://github.com/ppoffice }
 */
(function ($, CONFIG) {
  var $main = $(".ins-search");
  var $input = $main.find(".ins-search-input");
  var $wrapper = $main.find(".ins-section-wrapper");
  var $container = $main.find(".ins-section-container");
  $main.parent().remove(".ins-search");
  $("body").append($main);

  function section(title) {
    // Create a new section element
    const newSection = document.createElement("section");
    newSection.classList.add("ins-section");
  
    // Create a new header element
    const newHeader = document.createElement("header");
    newHeader.classList.add("ins-section-header");
    newHeader.textContent = title;
  
    // Append the header to the section
    newSection.appendChild(newHeader);
  
    return newSection;
  }

  function searchItem(icon, title, slug, preview, url) {
    // Create a div element with "ins-selectable" and "ins-search-item" classes
    const searchItemDiv = document.createElement("div");
    searchItemDiv.classList.add("ins-selectable");
    searchItemDiv.classList.add("ins-search-item");

    // Create a header element
    const header = document.createElement("header");

    // Create an i element with "icon" and "icon-{icon}" classes
    const i = document.createElement("i");
    i.classList.add("icon");
    i.classList.add("icon-" + icon);
    header.appendChild(i);

    // Append the title or untitled text to the header
    if (title != null && title != "") {
      header.appendChild(document.createTextNode(title));
    } else {
      header.appendChild(
        document.createTextNode(CONFIG.TRANSLATION["UNTITLED"])
      );
    }

    // Create and append a span element with "ins-slug" class if slug is provided
    if (slug) {
      const span = document.createElement("span");
      span.classList.add("ins-slug");
      span.textContent = slug;
      header.appendChild(span);
    }

    searchItemDiv.appendChild(header);

    // Create and append a p element with "ins-search-preview" class if preview is provided
    if (preview) {
      const p = document.createElement("p");
      p.classList.add("ins-search-preview");
      p.textContent = preview;
      searchItemDiv.appendChild(p);
    }

    // Set the "data-url" attribute to the provided url
    searchItemDiv.setAttribute("data-url", url);

    return searchItemDiv;
  }

  function sectionFactory(type, array) {
    var sectionTitle;
    var $searchItems;
    if (array.length === 0) return null;
    sectionTitle = CONFIG.TRANSLATION[type];
    switch (type) {
      case "POSTS":
        $searchItems = array.map(function (item) {
          // Use config.root instead of permalink to fix url issue
          return searchItem(
            "file",
            item.title,
            null,
            item.content.slice(0, 150),
            item.uri
          );
        });
        break;
      case "CATEGORIES":
      case "TAGS":
        $searchItems = array.map(function (item) {
          return searchItem(
            type === "CATEGORIES" ? "folder" : "tag",
            item.title,
            "",
            null,
            item.uri
          );
        });
        break;
      default:
        return null;
    }
    return section(sectionTitle).append($searchItems);
  }

  function parseKeywords(keywords) {
    return keywords
      .split(" ")
      .filter(function (keyword) {
        return !!keyword;
      })
      .map(function (keyword) {
        return keyword.toUpperCase();
      });
  }

  /**
   * Judge if a given post/page/category/tag contains all of the keywords.
   * @param Object            obj     Object to be weighted
   * @param Array<String>     fields  Object's fields to find matches
   */
  function filter(keywords, obj, fields) {
    var result = false;
    var keywordArray = parseKeywords(keywords);
    var containKeywords = keywordArray.filter(function (keyword) {
      var containFields = fields.filter(function (field) {
        if (!obj.hasOwnProperty(field)) return false;
        if (obj[field].toUpperCase().indexOf(keyword) > -1) return true;
      });
      if (containFields.length > 0) return true;
      return false;
    });
    return containKeywords.length === keywordArray.length;
  }

  function filterFactory(keywords) {
    return {
      POST: function (obj) {
        return filter(keywords, obj, ["title", "content"]);
      },
      PAGE: function (obj) {
        return filter(keywords, obj, ["title", "content"]);
      },
      CATEGORY: function (obj) {
        return filter(keywords, obj, ["title"]);
      },
      TAG: function (obj) {
        return filter(keywords, obj, ["title"]);
      },
    };
  }

  /**
   * Calculate the weight of a matched post/page/category/tag.
   * @param Object            obj     Object to be weighted
   * @param Array<String>     fields  Object's fields to find matches
   * @param Array<Integer>    weights Weight of every field
   */
  function weight(keywords, obj, fields, weights) {
    var value = 0;
    parseKeywords(keywords).forEach(function (keyword) {
      var pattern = new RegExp(keyword, "img"); // Global, Multi-line, Case-insensitive
      fields.forEach(function (field, index) {
        if (obj.hasOwnProperty(field)) {
          var matches = obj[field].match(pattern);
          value += matches ? matches.length * weights[index] : 0;
        }
      });
    });
    return value;
  }

  function weightFactory(keywords) {
    return {
      POST: function (obj) {
        return weight(keywords, obj, ["title", "content"], [3, 1]);
      },
      PAGE: function (obj) {
        return weight(keywords, obj, ["title", "content"], [3, 1]);
      },
      CATEGORY: function (obj) {
        return weight(keywords, obj, ["title"], [1]);
      },
      TAG: function (obj) {
        return weight(keywords, obj, ["title"], [1]);
      },
    };
  }

  function search(json, keywords) {
    let WEIGHTS = weightFactory(keywords);
    let FILTERS = filterFactory(keywords);
    let posts = json.posts;
    let tags = json.tags;
    let categories = json.categories;
    return {
      posts: posts
        .filter(FILTERS.POST)
        .sort(function (a, b) {
          return WEIGHTS.POST(b) - WEIGHTS.POST(a);
        })
        .slice(0, 5),
      categories: categories
        .filter(FILTERS.CATEGORY)
        .sort(function (a, b) {
          return WEIGHTS.CATEGORY(b) - WEIGHTS.CATEGORY(a);
        })
        .slice(0, 5),
      tags: tags
        .filter(FILTERS.TAG)
        .sort(function (a, b) {
          return WEIGHTS.TAG(b) - WEIGHTS.TAG(a);
        })
        .slice(0, 5),
    };
  }

  function searchResultToDOM(searchResult) {
    $container.empty();
    for (const key in searchResult) {
      $container.append(sectionFactory(key.toUpperCase(), searchResult[key]));
    }
  }

  function scrollTo($item) {
    if ($item.length === 0) return;
    const wrapperHeight = $wrapper[0].clientHeight;
    const itemTop = $item.position().top - $wrapper.scrollTop();
    const itemBottom = $item[0].clientHeight + $item.position().top;
    if (itemBottom > wrapperHeight + $wrapper.scrollTop()) {
      $wrapper.scrollTop(itemBottom - $wrapper[0].clientHeight);
    }
    if (itemTop < 0) {
      $wrapper.scrollTop($item.position().top);
    }
  }

  function selectItemByDiff(value) {
    const $items = $.makeArray($container.find(".ins-selectable"));
    let prevPosition = -1;
    $items.forEach(function (item, index) {
      if ($(item).hasClass("active")) {
        prevPosition = index;
        return;
      }
    });
    const nextPosition = ($items.length + prevPosition + value) % $items.length;
    $($items[prevPosition]).removeClass("active");
    $($items[nextPosition]).addClass("active");
    scrollTo($($items[nextPosition]));
  }

  function gotoLink($item) {
    if ($item && $item.length) {
      location.href = $item.attr("data-url");
    }
  }

  $.getJSON(CONFIG.CONTENT_URL, function (json) {
    if (location.hash.trim() === "#ins-search") {
      $main.addClass("show");
    }
    $input.on("input", function () {
      const keywords = $(this).val();
      searchResultToDOM(search(json, keywords));
    });
    $input.trigger("input");
  });

  let searchTriggerCounter = 0;
  let searchTriggerTimeoutID = null;
  function searchTrigger(action) {
    if (searchTriggerCounter === 0) {
      searchTriggerCounter += 1;
      searchTriggerTimeoutID = setTimeout(
        () => (searchTriggerCounter = 0),
        500
      );

      return;
    }

    // press key twice
    searchTriggerCounter = 0;
    clearTimeout(searchTriggerTimeoutID);

    if (action === "show") {
      $main.addClass("show");
    } else {
      $main.removeClass("show");
    }
  }

  $(document)
    .on("click focus", ".search-form-input", function () {
      $main.addClass("show");
      $input.focus();
    })
    .on("click", ".ins-search-item", function () {
      gotoLink($(this));
    })
    .on("click", ".ins-close", function () {
      $main.removeClass("show");
    })
    .on("keydown", function (e) {
      // search popup is closed
      if (!$main.hasClass("show")) {
        switch (e.code) {
          case ("Shift", "ShiftRight", "ShiftLeft"):
            searchTrigger("show");
            $input.focus();
        }
        return;
      }

      // search popup is showed
      switch (e.code) {
        case "Escape":
          $main.removeClass("show");
          break;
        case "ArrowUp":
          selectItemByDiff(-1);
          break;
        case "ArrowDown":
          selectItemByDiff(1);
          break;
        case "Enter": //ENTER
          gotoLink($container.find(".ins-selectable.active").eq(0));
          break;
        case ("Shift", "ShiftRight", "ShiftLeft"):
          searchTrigger("close");
      }
    });
})(jQuery, window.INSIGHT_CONFIG);

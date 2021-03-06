/*   Copyright 2017 Agneta Network Applications, LLC.
*
*   Source file: theme/source/main/route.module.js
*
*   Licensed under the Apache License, Version 2.0 (the "License");
*   you may not use this file except in compliance with the License.
*   You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
*   Unless required by applicable law or agreed to in writing, software
*   distributed under the License is distributed on an "AS IS" BASIS,
*   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*   See the License for the specific language governing permissions and
*   limitations under the License.
*/
var app = angular.module('MainApp');

function getViewURL(path) {
  return agneta.urljoin({
    path: [agneta.services.view, path],
    query: {
      type: 'view'
    }
  });
}

app.config(function($routeProvider, $locationProvider) {
  var routePath = agneta.url('/:path*');

  $routeProvider
    .when('*', {
      reloadOnSearch: false
    })
    .when('/', {
      templateUrl: function() {
        var result = getViewURL(agneta.lang);
        return result;
      },
      reloadOnSearch: false,
      resolve: {
        data: function($rootScope) {
          return $rootScope.loadData(agneta.lang);
        }
      }
    })
    .when(routePath, {
      templateUrl: function(params) {
        var result = getViewURL(params.path);
        return result;
      },
      reloadOnSearch: false,
      resolve: {
        data: function($rootScope) {
          return $rootScope.loadData();
        }
      }
    })
    .otherwise({
      redirect: true
    });

  // use the HTML5 History API
  $locationProvider.html5Mode(true);
});

app.run(function($rootScope, $timeout, $window, $route, $location, $mdDialog) {
  var nonLoading = false;

  $rootScope.changeLanguage = function(lang) {
    var url = agneta.langPath({
      path: $rootScope.viewData.path,
      lang: lang
    });
    window.location.href = url;
  };

  $rootScope.$on('$routeChangeStart', function() {
    if (nonLoading) {
      return;
    }
    $rootScope.loadingMain = true;
    var searchData = $location.search();
    delete searchData.version;
    $location.search(searchData);
  });

  $location.pathUpdate = function(path) {
    if (path == $location.path()) {
      return;
    }
    nonLoading = true;
    var lastRoute = $route.current;
    var un = $rootScope.$on('$locationChangeSuccess', function() {
      $route.current = lastRoute;
      nonLoading = false;
      un();
    });
    $location.replace();
    return $location.path(path);
  };

  $rootScope.$on('$routeChangeError', function(rejection) {
    if (rejection.unauthorized) {
      $mdDialog.open({
        partial: 'unauthorized',
        data: {}
      });
      return;
    }

    if (rejection.login) {
      $rootScope.account.login();
      return;
    }

    console.log(rejection);

    $mdDialog.open({
      partial: 'error',
      nested: true,
      data: {
        title: 'Unable to load page',
        content:
          'The location provided could not load\nReason: ' + rejection.message
      }
    });
  });

  $rootScope.$on('$routeChangeSuccess', function(event, current) {
    if (current.redirect) {
      $window.location.reload();
      return;
    }
    if (!current) {
      console.error('View did not load correctly');
      return;
    }

    // Check if link has an anchor and scroll to that elmYPosition

    var hash = $location.hash();
    if (hash) {
      $timeout(function() {
        $rootScope.scrollTo(hash);
      }, 300);
    }

    //

    var queryString = $location.url().split('?')[1];
    if (queryString) {
      queryString = '?' + queryString;
    }
    $rootScope.queryString = queryString;

    //

    var data = current.locals.data;

    $rootScope.addRouteParams = function(params) {
      var query = $location.search();
      angular.extend(query, params);
      $timeout(function() {
        $location.search(query).replace();
      });
    };

    $rootScope.viewData = data;
    $rootScope.loadingMain = false;
    $mdDialog.hide();
  });
});

app.directive('agInclude', function($compile, $rootScope, $templateRequest) {
  return {
    restrict: 'A',
    link: function($scope, $element, $attrs) {
      var childScope;

      $attrs.$observe('page', function(page) {
        console.log(page);
        if (!page) {
          return;
        }
        page = `${agneta.lang}/${page}`;

        var viewURL = getViewURL(page);

        if (childScope) {
          childScope.$destroy();
          childScope = undefined;
        }

        return $rootScope
          .loadData(page)
          .then(function() {
            return $templateRequest(viewURL);
          })
          .then(function(html) {
            var DOM = angular.element(html);

            childScope = $scope.$new();
            childScope.$on('$destroy', function() {
              compiledElement.remove();
            });

            var compiledElement = $compile(DOM)(childScope);
            $element.empty();
            $element.append(compiledElement);
          });
      });
    }
  };
});

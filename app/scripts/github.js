const OAuth2 = require("./oauth2");

const GithubAdapter = OAuth2.adapter('github', {
  authorizationCodeURL: function(config) {
    return ('https://github.com/login/oauth/authorize?' +
      'client_id={{CLIENT_ID}}&' +
      'redirect_uri={{REDIRECT_URI}}&' +
      'scope={{API_SCOPE}}&' +
      'response_type=code')
        .replace('{{CLIENT_ID}}', config.clientId)
        .replace('{{REDIRECT_URI}}', this.redirectURL(config))
        .replace('{{API_SCOPE}}', config.apiScope);
  },

  redirectURL: function(config) {
    return 'https://github.com/robots.txt';
  },

  basicAuthenticationRequired: function(){
    return true;
  },

  parseAuthorizationCode: function(url) {
    console.log(url);
    var error = url.match(/[&\?]error=([^&]+)/);
    if (error) {
      throw 'Error getting authorization code: ' + error[1];
    }
    return url.match(/[&\?]code=([\w\/\-]+)/)[1];
  },

  accessTokenURL: function() {
    return 'https://github.com/login/oauth/access_token';
  },

  accessTokenMethod: function() {
    return 'POST';
  },

  accessTokenParams: function(authorizationCode, config) {
    return {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
      redirect_uri: 'https://github.com/robots.txt'//this.redirectURL(config)
    };
  },

  refreshTokenParams: function(refreshToken, config) {
    return {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: 'https://github.com/robots.txt'//this.redirectURL(config)
    };
  },

  parseAccessToken: function(response) {
    /*console.log(response);
    var parsedResponse = JSON.parse(response);
    return {
      accessToken: parsedResponse.access_token,
      refreshToken: parsedResponse.refresh_token,
      expiresIn: parsedResponse.expires_in
    };*/
    var pars = response.split("&").map((el) => {return el.split("=")});
    var aux = pars.find((el) => {return el[0]=='access_token'});
    if(aux!=null){
      return {
        accessToken: aux[1],
        refreshToken: null,
        expiresIn: null
      }
    }
    else return null;
  }
});

module.export = GithubAdapter;

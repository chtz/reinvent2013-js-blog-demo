(function() {
  AWS.config.update({
    region: appInfo.region,
    logger: console
  });

  AWS.config.credentials = new AWS.WebIdentityCredentials({
    RoleArn: appInfo.roleArn,
    ProviderId: appInfo.providerId
  });

  var adminLoggedIn = false;
  var fbUser = "anonymous";

  var s3 = new AWS.S3({
    paramValidation: false,
    computeChecksums: false,
    params: {Bucket: appInfo.s3bucket}
  });

  var loginButton = document.getElementById('login-button');
  var reloadButton = document.getElementById('reload-button');
  var addButton = document.getElementById('add-button');
  var keyText = document.getElementById('key');
  var messageText = document.getElementById('message');
  var messagesUl = document.getElementById('messages');

  function uploadAsset(key, value) {
      var params = {
        Key: key,
        ContentType: 'application/json',
        Body: value
      };

      s3.putObject(params, function (err, data) {
        if (err) {
          console.log("Error uploading asset to S3", err.message);
        } else {
		  console.log("Uploaded");
        }
      });
  }

  function displayMessage(msg) {
	try {
		var xdecrypted = CryptoJS.AES.decrypt(msg, keyText.value);
		
		console.log("dec: " + xdecrypted.toString(CryptoJS.enc.Utf8));
		
		msg = xdecrypted.toString(CryptoJS.enc.Utf8);
		
		if (msg != '') {
			var li = document.createElement('li');
			var txt = document.createTextNode(msg);
			li.appendChild(txt);
			
			if(messagesUl.firstChild) messagesUl.insertBefore(li,messagesUl.firstChild);
			else messagesUl.appendChild(li);
		}
	}
	catch (err) {
		//ignore
	}
  }

  function loadMessage(key) {
	var params = {
        Key: key
    };

    s3.getObject(params, function (err, data) { 
        if (err) {
          console.log("Error retrieving asset from S3", err.message);
        } else {
		  console.log(data.Body.toString());
		
		  displayMessage(data.Body.toString());
        }
    });
  }

  function loadMessages() {
	while (messagesUl.firstChild) {
	    messagesUl.removeChild(messagesUl.firstChild);
	}
	
	var params = {
        Prefix: fbUser + "/messages/"
    };

    s3.listObjects(params, function (err, data) { //FIXME iterate
        if (err) {
          console.log("Error listing assets in S3", err.message);
        } else {
		  console.log(data);
		
		  var keys = new Array();
		
		  for (var i=0; i < data.Contents.length; i++) {
			var content = data.Contents[i];
			
			if (content.Key != params.Prefix) {
				keys.push(content.Key);
			}
		  }
		
		  keys.sort();
		  for (var i=0; i < keys.length; i++) {
			loadMessage(keys[i]);
		  }
		
        }
    });
  }

  function addMessage() {
	var currentTimeMillis = new Date().getTime();
	
	var plain = messageText.value;
	
	var xencrypted = CryptoJS.AES.encrypt(plain, keyText.value);
	
	console.log("enc: " + xencrypted.toString())
	
	uploadAsset(fbUser + "/messages/" + currentTimeMillis, xencrypted.toString());
	
	displayMessage(xencrypted.toString());
	
	messageText.value = '';
  }

  function adminLogin() {
    if (adminLoggedIn) { FB.logout(); }
    else { FB.login(); }
  }

  window.fbAsyncInit = function() {
    FB.init({appId: appInfo.appId});

    FB.Event.subscribe('auth.authResponseChange', function(response) {
      if (response.status === 'connected') {
        AWS.config.credentials.params.WebIdentityToken =
          response.authResponse.accessToken;
        AWS.config.credentials.refresh(function (err) {
          if (err) {
            console.log("Error logging into application", err.message);
            loginButton.innerText = 'Login';
            adminLoggedIn = false;
			fbUser = "anonymous";
          } else {
            console.log("Logged into application as FB user: " + response.authResponse.userID);
            loginButton.innerText = 'Logout';
            adminLoggedIn = true;
			fbUser = response.authResponse.userID;
			
			uploadAsset(fbUser + "/lastlog", JSON.stringify(new Date()));
          }
        });
      } else {
        console.log("Logged out");
        loginButton.innerText = 'Login';
        adminLoggedIn = false;
		fbUser = "anonymous";
      }
    });

    FB.getLoginStatus();
  };

  (function(d, s, id){
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement(s); js.id = id;
    js.src = "//connect.facebook.net/en_US/all.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));

  loginButton.addEventListener('click', adminLogin, false);
  addButton.addEventListener('click', addMessage, false);
  reloadButton.addEventListener('click', loadMessages, false);
})();

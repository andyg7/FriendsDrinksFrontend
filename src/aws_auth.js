global.fetch = require('node-fetch');
var AmazonCognitoIdentity = require('amazon-cognito-identity-js');
var CognitoUserPool = AmazonCognitoIdentity.CognitoUserPool;

var poolData = {
    UserPoolId: 'us-east-1_sFPmZMOoq', // Your user pool id here
    ClientId: '3f1crpdsji4vsav79b3s9qfjld', // Your client id here
};

var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

var awsSignup = {
	userPool: new AmazonCognitoIdentity.CognitoUserPool(poolData),
	signup: function (email, password, res) {
		var attributeList = [];

		var dataEmail = {
			Name: 'email',
			Value: email,
		};

		var attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute(dataEmail);

		attributeList.push(attributeEmail);

		this.userPool.signUp(email, password, attributeList, null, (err, data) => {
			if (err) {
				return console.error(err);
			}
			return res.send(data.user);
		});
	},
	login: function (email, password, res) {
		var authenticationData = {
			Username: email,
			Password: password,
		};
		var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(
			authenticationData
		);
		var userData = {
			Username: email,
			Pool: this.userPool,
		};
		var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
		cognitoUser.authenticateUser(authenticationDetails, {
			onSuccess: function (result) {
				res.send(result);
			},

			onFailure: function (err) {
				res.send(JSON.stringify(err));
			}
		});
	},
	forgotPassword: function (email, res) {
		var userData = {
			Username: email,
			Pool: this.userPool,
		};
		var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
		cognitoUser.forgotPassword({
			onSuccess: function (result) {
				res.send(result);
			},
			onFailure: function (err) {
				res.send(JSON.stringify(err));
			}
		});
	},
	resetPassword: function (verificationCode, email, newPassword, res) {
		var userData = {
			Username: email,
			Pool: this.userPool,
		};
		var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
		cognitoUser.confirmPassword(verificationCode, newPassword, {
			onSuccess: function () {
				res.send('Successfully reset password!');
			},
			onFailure: function (err) {
				res.send(JSON.stringify(err));
			}
		});
	}
}

module.exports = {
	awsSignup: awsSignup,
	userPool: userPool,
}

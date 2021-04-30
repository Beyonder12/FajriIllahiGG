
const validate = require("validate.js");
const path = require('path');
const async = require("async");
// const crypto = require("crypto-js");
// const admin = require('firebase-admin');
const ejs = require("ejs");
const fs = require('fs');
const moment = require('moment-timezone');


module.exports = function (Account) {


  Account.signUpAccountJenius = async function (data) {
    //payload: {username: "string", password: "string"}

    try {
      //manual error handling
      if (!data.hasOwnProperty("email")) {
        const error = new Error("Error: Please fill your email before login to Jenius Application!");
        error.statusCode = 412;
        throw error;
      };

      if (!data.hasOwnProperty("password")) {
        const error = new Error("Error: Not only the email, you should fill the password as well!");
        error.statusCode = 412;
        throw error;
      };

      Account.create(data);
      return Promise.resolve({status:"success", data:data});
    } catch (err) {
      return Promise.reject(err);
    }
  }

  Account.remoteMethod(
      "signUpAccountJenius", {
        description: ["add account"],
        accepts: [
          {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "Data Pasien"},
          {arg: "options", type: "object", http: "optionsFromRequest"}
        ],
        returns: {
          arg: "status", type: "object", root: true, description: "Return value"
        },
        http: {verb: "post"}
      }
  );

  Account.loginAccountJenius = async function (data, options) {
    //payload: {username: "string", password: "string"}

    const AccessToken = Account.app.models.AccessToken;

    try {
      
      if (!data.hasOwnProperty("email")) {
        const error = new Error("Error: Please fill your email before login to Jenius Application!");
        error.statusCode = 412;
        throw error;
      };

      if (!data.hasOwnProperty("password")) {
        const error = new Error("Error: Not only the email, you should fill the password as well!");
        error.statusCode = 412;
        throw error;
      };

      const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
      data['cretedDate'] = new Date(todayMomentJkt);
     
    

      // TODO: when access relations and provider made, input it here
      var account = await Account.find({where:{or: [{email: data['email']}, {username: data['email']}]}});

      
      let loginEmail = '';
      if (account.length == 0) {
        const error = new Error("Account is not exists");
        error.statusCode = 404;
        throw error;
      } else {
        account = account[0];
        loginEmail = account.email;
        if (data['email'] == account['username']) {
          delete data['email'];
          data['username'] = account['username'];
        }
      }
    

      await AccessToken.destroyAll({userId: account['id']});
      var accessToken = await Account.login(data);
      
      if (!accessToken) {
        const error = new Error("Wrong password");
        error.statusCode = 412;
        throw error;
      }
      
      
      accessToken['name'] = account['nama'] || account['name'];
      // accessToken['email'] = account['email'];
      accessToken['email'] = loginEmail;
      accessToken['username'] = account['username'];
      

      if (account) {
        const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
        await Account.updateAll({id: account['id']},
          {
            lastLogin: new Date(todayMomentJkt),
            isLogin: true
          });
      }

      return Promise.resolve({status:"success", data:accessToken});
    } catch (err) {
      return Promise.reject(err);
    }
  }

  Account.remoteMethod(
      "loginAccountJenius", {
        description: ["add account"],
        accepts: [
          {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "Data Pasien"},
          {arg: "options", type: "object", http: "optionsFromRequest"}
        ],
        returns: {
          arg: "status", type: "object", root: true, description: "Return value"
        },
        http: {verb: "post"}
      }
  );


  Account.disableRemoteMethod("create", true);
  Account.disableRemoteMethod("upsert", true);
  Account.disableRemoteMethod("updateAll", true);
  Account.disableRemoteMethod("updateAttributes", false);
  Account.disableRemoteMethod("find", true);
  Account.disableRemoteMethod("findById", true);
  Account.disableRemoteMethod("findOne", true);
  Account.disableRemoteMethod("deleteById", true);
  Account.disableRemoteMethod("confirm", true);
  Account.disableRemoteMethod("count", true);
  Account.disableRemoteMethod("exists", true);
  Account.disableRemoteMethod("resetPassword", true);
  Account.disableRemoteMethod('replaceOrCreate', true);
  Account.disableRemoteMethod('replaceById', true);
  Account.disableRemoteMethod('createChangeStream', true);
  Account.disableRemoteMethod("upsertWithWhere", true);
  Account.disableRemoteMethod("login", true);
  Account.disableRemoteMethod("creator", true);
  Account.disableRemoteMethodByName("upsert", true);
  Account.disableRemoteMethodByName("updateAll", true);
  Account.disableRemoteMethodByName("updateAttributes", false);
  Account.disableRemoteMethodByName("deleteById", true);
  Account.disableRemoteMethodByName("count", true);
  Account.disableRemoteMethodByName("exists", true);
  Account.disableRemoteMethodByName("resetPassword", true);
  Account.disableRemoteMethodByName('__count__accessTokens', false);
  Account.disableRemoteMethodByName('__create__accessTokens', false);
  Account.disableRemoteMethodByName('__delete__accessTokens', false);
  Account.disableRemoteMethodByName('__destroyById__accessTokens', false);
  Account.disableRemoteMethodByName('__get__accessTokens', false);
  Account.disableRemoteMethodByName('__updateById__accessTokens', false);
};


const validate = require("validate.js");
const path = require('path');
const async = require("async");
// const crypto = require("crypto-js");
// const admin = require('firebase-admin');
const ejs = require("ejs");
const fs = require('fs');


module.exports = function (Account) {

  Account.loginAccount = async function (data, options) {
    //payload: {username: "string", password: "string"}

    const ConfigAccount = Account.app.models.ConfigAccount;
    const Config = Account.app.models.Config;
    const AccessRight = Account.app.models.AccessRight;
    const AccessToken = Account.app.models.AccessToken;

    var queryCheck = [], isDataEmail = false, isDataUsername = false, isDataHp = false;

    try {
      
      if (!data.hasOwnProperty("email")) return Promise.resolve({status:"error",data:"Email is required"});
      if (!data.hasOwnProperty("password")) return Promise.reject({status:"error",data:"Password is required"});

      // TODO: when access relations and provider made, input it here
      var account = await Account.find({where:{or: [{email: data['email']}, {username: data['email']}]}});

      
      let loginEmail = '';
      if (account.length == 0) {
        return Promise.reject({status:"error",data:"Account is not exists"});
      } else {
        account = account[0];
        loginEmail = account.email;
        if (data['email'] == account['username']) {
          delete data['email'];
          data['username'] = account['username'];
        }
      }
      

      var configAccount = await ConfigAccount.find({where: {accountId: account['id']}});
      if (configAccount.length == 0) {
        const err = new Error("You have technical issues [1], please contact Assist.id team")
        err.name = "errorrr";
        err.code = 400;
        return Promise.reject(err);
      } else {
        configAccount = configAccount[0];
      }

      var config = await Config.findById(configAccount['configId']);
      if (config == null) {
        return Promise.reject({status:"error",data:"You have technical issues [2], please contact Assist.id team"});
      }

      var accessRight = await AccessRight.findById(configAccount['accessId'])
      if (accessRight == null) {
        return Promise.reject({status:"error",data:"You have technical issues [3], please contact Assist.id team"});
      }

      await AccessToken.destroyAll({userId: account['id']});
      var accessToken = await Account.login(data);
      
      if (!accessToken) {
        return Promise.reject({status:"error",data:"Wrong password"});
      }
      
      accessToken['placeId'] = configAccount['placeId'];
      accessToken['RoleActions'] = accessRight;
      accessToken['Configs'] = config;
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
      "loginAccount", {
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


  Account.disableRemoteMethodByName("upsert", true);
  // Account.disableRemoteMethodByName("updateAll", true);
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

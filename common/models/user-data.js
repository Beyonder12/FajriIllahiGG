const validate = require("validate.js");
const path = require('path');
const async = require("async");
// const crypto = require("crypto-js");
// const admin = require('firebase-admin');
const ejs = require("ejs");
const fs = require('fs');
const moment = require('moment-timezone');

module.exports = function(UserData) {

// CRUD Operation : Create Method
UserData.createJenius = async function (data,options) {
    //payload: {username: "string", password: "string"}

    try {
        const Account = UserData.app.models.Account;
        const token = options && options.accessToken;
        if (!token) {
            const error = new Error("Please login before access the Jenius Application!");
            error.statusCode = 401;
            throw error;
        }
     
        const userId = token && token.userId;
        if (!userId) {
            const error = new Error("You have no access to this Jenius Application");
            error.statusCode = 401;
            throw error;
        }
        
        var account = await Account.findById(userId);
        if (!account) {
            const error = new Error("Jenius can't find your account");
            error.statusCode = 404;
            throw error;
        }

        const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
        data['cretedDate'] = new Date(todayMomentJkt);
        data['createdName'] = account['name'] || account['username'];
        UserData.create(data);
        return Promise.resolve({status:"success", data:data});
    } catch (err) {
        return Promise.reject(err);
    }
}

UserData.remoteMethod(
    "createJenius", {
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

// CRUD Operation : Update Method
UserData.updateJenius = async function (id, options) {
    // payload: {id: "string"}

    try {
        const Account = Rack.app.models.Account;
        const token = options && options.accessToken;
        if (!token) return Promise.reject({status:"error",data:"Please login to access this feature"});
        const userId = token && token.userId;
        if (!userId) return Promise.reject({status:"error",data:"You have no access to this feature"});
        if (!id) return Promise.reject({status:"error",data:"Id cannot empty"});
        var account = await Account.findById(userId);
        if (!account) return Promise.reject({status:"error",data:"Your account has problem, call Assist.id team"});

        const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
        var data = {};
        data['deletedId'] = userId;
        data['deletedDate'] = new Date(todayMomentJkt);
        data['deletedName'] = account['name'];
        data['isActive'] = false;
        var rack = await Rack.updateAll({id: id}, data);
        if (rack['count'] > 0) {
        return Promise.resolve({status: "success", item: rack});
        } else {
        return Promise.reject({status: "error", data: "Please make sure your id is right"});
        }
    } catch (err) {
        return Promise.reject(err);
    }
    }

UserData.remoteMethod(
    "updateJenius", {
    description: ["Soft delete Rack by id by changing isDeleted property to true ( Settings -> Rack)"],
    accepts: [
        {arg: "id", type: "string", http: {source: 'path'}, required: true, description: "Id 5fa26188bd67d3df5407d018 "},

        {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
        arg: "status", type: "object", root: true, description: "Return value"
    },
    http: {verb: "put", path: "/:id/updateJenius"}
    }
);

  UserData.disableRemoteMethod("create", true);
  UserData.disableRemoteMethod("upsert", true);
  UserData.disableRemoteMethod("updateAll", true);
  UserData.disableRemoteMethod("updateAttributes", false);
  UserData.disableRemoteMethod("find", true);
  UserData.disableRemoteMethod("findById", true);
  UserData.disableRemoteMethod("findOne", true);
  UserData.disableRemoteMethod("deleteById", true);
  UserData.disableRemoteMethod("confirm", true);
  UserData.disableRemoteMethod("count", true);
  UserData.disableRemoteMethod("exists", true);
  UserData.disableRemoteMethod("resetPassword", true);
  UserData.disableRemoteMethod('replaceOrCreate', true);
  UserData.disableRemoteMethod('replaceById', true);
  UserData.disableRemoteMethod('createChangeStream', true);
  UserData.disableRemoteMethod("upsertWithWhere", true);

};

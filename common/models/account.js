
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
  
  
    Rumahsakit.remoteMethod('getStaffListIsOpenedLedger', {
    description: ["get staff list"],
    accepts: [
      { arg: 'filter', type: 'object', required:true, description:"this is filter of staff" },
      { arg: 'options', type: 'object', http:"optionsFromRequest"},

    ],
    returns: {
      arg: "status", type: "object", root: true, description: "Return value"
    },
    http: { verb: "get" }
  });

  Rumahsakit.getStaffListIsOpenedLedgerV2 = async function (filter, skip, limit, sort, options) {
    // DESC PO barang
    // payload : {placeId: "string", search: "string", dateStart: "string", dateEnd: "start"}
    const { Ledger } = Rumahsakit.app.models;

    try {
      const token = options && options.accessToken;
      if(!token) {
        const error = new Error('Please login to access this feature');
        error.statusCode = 401;
        throw error;
      }
      const userId = token && token.userId;
      if(!userId) {
        const error = new Error('Where do you get this authentication');
        error.statusCode = 401;
        throw error;
      }
      var constraints = {
        hospitalId: {presence: true}
      };

      var validation = validate(filter, constraints);
      if (validation) {
        const error = new Error("error");
        error.statusCode = 412;
        error.message = validation;
        throw error;
      }


      var $$QUERY = {}, $$SEARCH_QUERY = {};



      if (filter.hasOwnProperty('search')) {
        $$SEARCH_QUERY['$or'] = [
          {code: {$regex: filter['search'], $options: 'i'}},
          {hospitalName: {$regex: filter['search'], $options: 'i'}},
          {status: {$regex: filter['search'], $options: 'i'}},
        ];
      }


      var $$ITEMS = 1;
      if (limit != null) {
        if (skip != null) {
          $$ITEMS = {$slice: ["$items", skip, limit]};
        } else {
          $$ITEMS = {$slice: ["$items", limit]};
        }
      }


      if (filter.hasOwnProperty('dateStart')) {
        if (filter.hasOwnProperty('dateEnd')) {
          $$SEARCH_QUERY['createdAt'] = {$gte: new Date(filter['dateStart']), $lte: new Date(filter['dateEnd'])};
        } else {
          $$SEARCH_QUERY['createdAt'] = {$gte: new Date(filter['dateStart'])};
        }
      } else {
        if (filter.hasOwnProperty('dateEnd')) {
          $$SEARCH_QUERY['createdAt'] = {$lte: new Date(filter['dateEnd'])};
        }
      }


      var $$LOOKUP_ITEMS = { $lookup: {
        from: "Masyarakat",
        localField: "createdId",
        foreignField: "_id",
        as: "Creator"
      }};

      const { connector, ObjectID } = Ledger.getDataSource();
      const $$hospitalId = ObjectID(filter['hospitalId']);
      $$QUERY['hospitalId'] = $$hospitalId;

      var $$SORT = {};

      var $$AGGREGATE = [];
      $$AGGREGATE.push({$match: $$QUERY});
      // $$AGGREGATE.push({
      //   $project: {
      //     _id: 1,
      //     returnedDate: 1,
      //     returnCode: 1,
      //     picReturnClientName: 1,
      //     hospitalName: 1,
      //     receivedDate: 1,
      //     status: 1,
      //     isActive:1,
      //   }
      // });
      if (filter.hasOwnProperty('search') || filter.hasOwnProperty('dateStart')) $$AGGREGATE.push({$match: $$SEARCH_QUERY});
      $$AGGREGATE.push($$LOOKUP_ITEMS);
      $$AGGREGATE.push({$sort: {receivedDate: -1}});
      $$AGGREGATE.push({$group: { _id: null, count: { $sum:1 }, items: { $push: '$$ROOT'}}});
      $$AGGREGATE.push({$project: {
        _id: 0,
        status: "success",
        count: 1,
        items: $$ITEMS
      }});

      // Raw query
      const itemCollection = connector.collection('Ledger');
      const itemCursor = await itemCollection.aggregate($$AGGREGATE);
      var results = await itemCursor.toArray();

      if (results.length == 0) {
        results = {status: "success", items: [], count:0 };
      } else {
        results = results[0];
      }

      // let results2 = await ReturnRequestItem.find();
      // console.log('result2', results2)

      return Promise.resolve(results);
    } catch (err) {
      return Promise.reject(err);
    }
  };


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

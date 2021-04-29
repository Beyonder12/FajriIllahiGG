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

UserData.readJenius = async function (filter, skip, limit, sort, options) {
    // payload : {placeId:"string", search:"string", dateStart: "date", dateEnd: "date"}

    try {
        const {Account} = UserData.app.models;
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

      var constraints = {
        placeId: {presence: true}
      };

      var validation = validate(filter, constraints);
      if (validation) return Promise.reject({status:"error",data:validation});

      var $$QUERY = {}, $$SEARCH_QUERY = {};
      $$QUERY['isActive'] = true;

      $$SEARCH_QUERY['$or'] = [
        {supplierName: {$regex: filter['search'], $options: "i"}},
        {code: {$regex: filter['search'], $options: "i"}},
        {item: {$regex: filter['search'], $options: "i"}}
      ];

      if (filter.hasOwnProperty('dateStart')) {
        if (filter.hasOwnProperty('dateEnd')) {

          var dateString = filter['dateEnd'];
          var startDate = new Date(dateString);
          // seconds * minutes * hours * milliseconds = 1 day
          var day = 60 * 60 * 24 * 1000;

          $$QUERY['createdDate'] = {$gte: new Date(filter['dateStart']), $lte: new Date(startDate.getTime() + day)};
        } else {
          $$QUERY['createdDate'] = {$gte: new Date(filter['dateStart'])};
        }
      } else {
        if (filter.hasOwnProperty('dateEnd')) {
          $$QUERY['createdDate'] = {$lte: new Date(filter['dateEnd'])};
        }
      }

      var $$ITEMS = 1;
      if (limit != null) {
        if (skip != null) {
          $$ITEMS = {$slice: ["$items", skip, limit]};
        } else {
          $$ITEMS = {$slice: ["$items", limit]};
        }
      }

      var $$LOOKUP_SUPPLIER = {$lookup: {
        from: "Supplier",
        localField: "supplierId",
        foreignField: "_id",
        as: "Suppliers"
      }};
      var $$UNWIND_SUPPLIER = {$unwind: {path: '$Suppliers', preserveNullAndEmptyArrays: true}};
      var $$LOOKUP_ITEMS = { $lookup: {
        from: "TxPurchaseItem",
        localField: "_id",
        foreignField: "poId",
        as: "TxPurchaseItems"
      }};

      const { connector, ObjectID } = TxPurchase.getDataSource();
      const $$placeId = ObjectID(filter['placeId']);
      $$QUERY['placeId'] = $$placeId;

      var $$AGGREGATE = [];
      $$AGGREGATE.push({$match: $$QUERY});
      $$AGGREGATE.push($$LOOKUP_SUPPLIER);
      $$AGGREGATE.push($$UNWIND_SUPPLIER);
      $$AGGREGATE.push($$LOOKUP_ITEMS);
      $$AGGREGATE.push({
        $project: {
          code: 1,
          supplierName: "$Suppliers.name",
          item: '$TxPurchaseItems.name',
          countItem: { $size: "$TxPurchaseItems" },
          totalFee: 1,
          createdName: 1,
          createdDate: 1,
        }
      });
      if (filter.hasOwnProperty('search')) $$AGGREGATE.push({$match: $$SEARCH_QUERY});
      $$AGGREGATE.push({$sort: {createdDate: -1}});
      $$AGGREGATE.push({$group: { _id: null, count: { $sum:1 }, items: { $push: '$$ROOT' }}});
      $$AGGREGATE.push({$project: {
        _id: 0,
        status: "success",
        count: 1,
        items: $$ITEMS
      }});

      // Raw query
      const itemCollection = connector.collection('TxPurchase');
      const itemCursor = await itemCollection.aggregate($$AGGREGATE);
      var results = await itemCursor.toArray();

      if (results.length == 0) {
        results = {status: "success", items: [], count:0 };
      } else {
        results = results[0];
      }

      return Promise.resolve(results);
    } catch (err) {
      return Promise.reject(err);
    }
  };

UserData.remoteMethod("readJenius", {
description: ["get list of inventory"],
accepts: [
    { arg: "filter", type: "object", required: true, description: "filter" },
    { arg: "skip", type: "number", required: false, description: "skip" },
    { arg: "limit", type: "number", required: false, description: "limit" },
    { arg: "sort", type: "string", required: false, description: "sort" },
    { arg: "options", type: "object", http: "optionsFromRequest"},
],
returns: {
    arg: "status", type: "object", root: true, description: "Return value"
},
http: {verb: "get"}
});

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

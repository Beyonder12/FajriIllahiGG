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
        data['isActive'] = true;
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
        {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "Data User"},
        {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
        arg: "status", type: "object", root: true, description: "Return value"
    },
    http: {verb: "post"}
    }
);

// CRUD Operation : Read Method
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
        accountNumber: {presence: true},
        identityNumber: {presence:true},
      };

      var validation = validate(filter, constraints);
      if (validation) {
          const error = new Error('Error Validation!');
          error.statusCode = 412;
          error.message = validation;
          throw error;
      }
      

      var $$QUERY = {}, $$SEARCH_QUERY = {};
      $$QUERY['isActive'] = true

      $$SEARCH_QUERY['$or'] = [
        {userName: {$regex: filter['search'], $options: "i"}},
        {emailAddress: {$regex: filter['search'], $options: "i"}},
        
      ];

      var $$ITEMS = 1;
      if (limit != null) {
        if (skip != null) {
          $$ITEMS = {$slice: ["$items", skip, limit]};
        } else {
          $$ITEMS = {$slice: ["$items", limit]};
        }
      };

      const { connector, ObjectID } = UserData.getDataSource();
    //   const $$_id = ObjectID(filter['_id']);
    //   $$QUERY['_id'] = $$_id;

      var $$AGGREGATE = [];
      $$AGGREGATE.push({$match: $$QUERY});
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
      const itemCollection = connector.collection('UserData');
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
    { arg: "filter", type: "object", required: true, description: "filter: exampe {\"accountNumber\":\"\", \"identityNumber\":\"\", \"search\":\"\"} " },
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
UserData.updateJenius = async function (id, data, options) {
    // payload: {id: "string"}

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
        if (!id) {
            const error = new Error("Id cannot empty");
            error.statusCode = 412;
            throw error;
        }
        var account = await Account.findById(userId);
        if (!account) {
            const error = new Error("Id cannot empty");
            error.statusCode = 404;
            throw error;
        }

        const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
      
        data['updatedId'] = userId;
        data['updatedDate'] = new Date(todayMomentJkt);
        data['updatedName'] = account['name'] || account['email'];
        // await UserData.save(data)
        console.log(data)
        
        var userData = await UserData.updateAll({id: id}, data);
        if (userData['count'] > 0) {
        return Promise.resolve({status: "success", item: userData});
        } else {
        const error = new Error ("Please make sure your id is right");
        error.statusCode = 404;
        throw error;
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
        {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "User data for updating"},
        {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
        arg: "status", type: "object", root: true, description: "Return value"
    },
    http: {verb: "put", path: "/:id/updateJenius"}
    }
);

// CRUD Operation : Update Method
UserData.softDeleteJenius = async function (id, options) {
    // payload: {id: "string"}

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
        if (!id) {
            const error = new Error("Id cannot empty");
            error.statusCode = 412;
            throw error;
        }
        var account = await Account.findById(userId);
        if (!account) {
            const error = new Error("Not found!");
            error.statusCode = 404;
            throw error;
        }

      const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
      var data = {};
      data['deletedId'] = userId;
      data['deletedDate'] = new Date(todayMomentJkt);
      data['deletedName'] = account['name'];
      data['isActive'] = false;
      var userData = await UserData.updateAll({id: id}, data);
      if (userData['count'] > 0) {
        return Promise.resolve({status: "success", item: userData});
      } else {
        const error = new Error("Please make sure your id is right");
        error.statusCode = 404;
        throw error;
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

UserData.remoteMethod(
    "softDeleteJenius", {
    description: ["Soft delete Customer by id by changing isDeleted property to true ( Settings -> Customer)"],
    accepts: [
        {arg: "id", type: "string", http: {source: 'path'}, required: true, description: "Id 5fa26188bd67d3df5407d018 "},

        {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
        arg: "status", type: "object", root: true, description: "Return value"
    },
    http: {verb: "put", path: "/:id/softDeleteJenius"}
    }
);

  // CRUD Operation : Delete Method
UserData.deleteJenius = async function (id, options) {
    
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
    if (!id) {
    const error = new Error("Id cannot empty");
    error.statusCode = 412;
    throw error;
    }
    

    var userData = await UserData.destroyAll({id: id});
    return Promise.resolve({status: "successfully deleted item permanently", item: userData});
} catch (err) {
    return Promise.reject(err);
}
};

UserData.remoteMethod(
    "deleteJenius", {
    description: ["Delete Dictionary by provided id(Settings > Kategori Barang)"],
    accepts: [
        {arg: "id", type: "string", http: {source: 'path'}, required: true, description: "Id"},

        {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
        arg: "status", type: "object", root: true, description: "Return status succeed"
    },
    http: {verb: "delete", path: "/:id/deleteJenius"}
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

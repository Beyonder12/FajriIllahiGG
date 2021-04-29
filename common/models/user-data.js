'use strict';

module.exports = function(UserData) {

    UserData.createJenius = async function (data,options) {
        //payload: {username: "string", password: "string"}
    
        try {
          
    
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

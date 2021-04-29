
const validate = require("validate.js");
const path = require('path');
const async = require("async");
const crypto = require("crypto-js");
const replace = require("str-replace");
const Sendgrid = require("sendgrid-web");
const admin = require('firebase-admin');
const ejs = require("ejs");
const fs = require('fs');


var assistUrl = localConfig.assistUrl;

module.exports = function (Account) {

  Account.createInitAccount = async function (data, req) {
    // payload: {username: "string", email: "string", password: "string"}

    const ConfigAccount = Account.app.models.ConfigAccount;
    const Config = Account.app.models.Config;
    const AccessRight = Account.app.models.AccessRight;
    const Occupation = Account.app.models.Occupation;
    const Place = Account.app.models.Place;

    var queryCheck = [], isDataEmail = false, isDataUsername = false, isDataHp = false;
    try {

      if (data.hasOwnProperty('email')) {
        queryCheck.push({'email':data['email']});
        isDataEmail = true;
      }

      if (data.hasOwnProperty('username')) {
        queryCheck.push({'username':data['username']});
        isDataUsername = true;
      }

      if (queryCheck.length == 0) {
        return Promise.reject({status:"error",data:"email /username is required"});
      }

      var account = await Account.find({where:{or:queryCheck}});
      var configAccount;
      if (account.length > 0) {
        account = account[0];
        configAccount = await ConfigAccount.find({where:{accountId: account['id']}});
        return Promise.reject({status:"error",data:"Your account exists, if you forget password use forget password"});
      } else {
        account = await Account.create(data);
      }

      var access = await AccessRight.find({where:{code :"AC0001"}});
      var occupation = await Occupation.find({where:{code :"OC0001"}});
      var config = await Config.find({where:{code :"CO0001"}});
      var place = await Place.find({where:{code :"PL0001"}});
      var accessId = access[0]['id'] || "";
      var occupationId = occupation[0]['id'] || "";
      var configId = config[0]['id'] || "";
      var placeId = place[0]['id'] || "";

      const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
      var configAccountData = {
        accountId : account['id'],
        accessId : accessId,
        configId : configId,
        occupationId : occupationId,
        placeId : placeId,
        name : account['name'],
        isActive : true,
        role : access['name'],
        occupation : occupation['name'],
        createdDate : new Date(todayMomentJkt),
        createdName : account['name'],
        createdId : account['id']
      };
      configAccount = await ConfigAccount.create(configAccountData);

      account['configData'] = configAccount;
      return Promise.resolve({status:"success", data:account});
    } catch (err) {
      return Promise.reject(err);
    }
  }

  Account.remoteMethod(
      "createInitAccount", {
        description: ["add account"],
        accepts: [
          {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "Data Pasien"},
          {arg: 'req', type: 'object', http: {source: 'req'}}
        ],
        returns: {
          arg: "status", type: "object", root: true, description: "Return value"
        },
        http: {verb: "post"}
      }
  );

  Account.afterRemote('createInitAccount', async function (context, user, next) {
    if (!user) return next();

    const userId = user['data']['id'];

    const Role = Account.app.models.Role;
    const RoleMapping = Account.app.models.RoleMapping;

    try {
      var role = await Role.find({where: {name: "warehouseUser"}});
      if (role.length == 0) throw err;
      role = role[0];

      var roleMapping = await RoleMapping.find({where: {principalType: RoleMapping.USER,
        principalId: userId, roleId: role['id']}});
      if (roleMapping.length == 0){
        await RoleMapping.create({principalType: RoleMapping.USER,
          principalId: userId, roleId: role['id']});
      }

      return next();
    } catch (err) {
      return Promise.reject(err);
    }
  });

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

  Account.loginCustomer = async function (data, options) {
    //payload: {username: "string", password: "string"}

    const ConfigAccount = Account.app.models.ConfigAccount;
    const Config = Account.app.models.Config;
    const AccessRight = Account.app.models.AccessRight;
    const AccessToken = Account.app.models.AccessToken;
    const Customer = Account.app.models.Customer;

    var queryCheck = [], isDataEmail = false, isDataUsername = false, isDataHp = false;

    try {
      if (!data.hasOwnProperty("appId")) return Promise.reject({status:"error",data:"AppId is required"});

      var loginData = {};
      // var appId = data['appId'].substring(5,data['appId'].length);
      var decrypt = crypto.DES.decrypt(data['appId'], process.env.CUSTOMER_SECRET_KEY);
      loginData['username'] = process.env.APP_PREFIX+decrypt.toString(crypto.enc.Utf8);
      loginData['password'] = process.env.CUSTOMER_SECRET_KEY.substring(0,2)+process.env.CUSTOMER_SECRET_KEY.substring(5,8)+"assist";

      var account = await Account.find({where:{username: loginData['username']}});
      if (account.length == 0) {
        return Promise.reject({status:"error",data:"Account is not exists"});
      } else {
        account = account[0];
      }

      await AccessToken.destroyAll({userId: account['id']});
      var accessToken = await Account.login(loginData);
      if (!accessToken) {
        return Promise.reject({status:"error",data:"Cannot get data"});
      }

      if (account) {
        const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
        await Account.updateAll({id: account['id']},
          {
            lastLogin: new Date(todayMomentJkt),
            isLogin: true
          });
      }

      var customer = await Customer.findById(account['customerId']);
      if (customer.length == 0) return Promise.reject({status:"error",data:"Data Customer ("+ decrypt.toString(crypto.enc.Utf8) +") Tidak Ditemukan"});
      accessToken['customerId'] = customer['id'];

      return Promise.resolve({status:"success", data: accessToken});
    } catch (err) {
      return Promise.reject(err);
    }
  }

  Account.remoteMethod(
      "loginCustomer", {
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

  Account.forgotPassword = async function (data, options) {
    //payload: {email: "string"}

    try {
      const { AccessToken, Email } = Account.app.models;
      if (!data.hasOwnProperty("email")) return Promise.reject({status:"error",data:"Email/Username is required"});

      var account = await Account.find({where:{or: [{email: data['email']}, {username: data['email']}]}});
      if (account.length == 0) {
        return Promise.reject({status:"error",data:"Account is not exists"});
      } else {
        account = account[0];
      }

      const accountId = account['id'];
      account.isNeedChangePassword = true;
      account.isLogin = false;

      if (accountId) {
        await AccessToken.destroyAll({ userId: accountId });
      }

      const tokens = await account.createAccessToken(10);
      await account.save();

      const pathTemplate = path.resolve(__dirname, "../../server/views/forgot-pass.ejs");
      const str = fs.readFileSync(pathTemplate, 'utf8');
      const url = 'https://warehouse-ibbr.assist.id/recovery?token='+ tokens.id;

      const messageHtml = ejs.render(str, {url: url});

      if (account['email']) {
        Email.send({
          to: account['email'],
          // from: "cust.support@medicaboo.com",
          from: localConfig.email,
          subject: "Medicaboo - Forgot Password",
          html: messageHtml
        }, function (err) {
          if (err) {
            return Promise.reject({status:"error", data:"Email cannot send, please contact your admin to get password changed"});
          }
        });
      }

      return Promise.resolve({ status: "success", data: "Check your email"});
    } catch (err) {
      return Promise.reject(err);
    }
  }

  Account.remoteMethod("forgotPassword", {
    description: ["request change password"],
    accepts: [
      {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "Data Pasien"},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
      arg: "result", type: "object", root: true, description: "Return value"
    },
    http: { verb: "post" }
  });

  Account.updatePassword = async function (data, options) {
    // payload: {token: "string (from email)", pass: "string", confPass: "string"}

    try {
      const { AccessToken } = Account.app.models;

      if (!data.hasOwnProperty('pass')) return Promise.reject({status:"error", data:"Password is required"});
      if (data['pass'] != data['confPass']) return Promise.reject({status:"error", data:"Password Baru berbeda dengan Konfirmasi Password"});

      var tokenInstance = await AccessToken.find({where: {_id: data['token']}});
      if (tokenInstance.length == 0) {
        return Promise.reject({status:"error", data:"Token tidak dapat digunakan"});
      }

      const userId = tokenInstance[0]['userId'];
      var account = await Account.findById(userId);

      if (account && account['isNeedChangePassword']) {
        account.isNeedChangePassword = false;
        await account.save();
        await account.updateAttribute("password", data['pass']);
        await AccessToken.destroyAll({_id: data['token']});
      } else {
        return Promise.reject({status:"error", data:"Token anda telah expired"});
      }

      return Promise.resolve({status: "success"});
    } catch (err) {
      return Promise.reject(err);
    }
  }

  Account.remoteMethod("updatePassword", {
    description: ["change password"],
    accepts: [
      {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "Data Pasien"},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
      arg: "result", type: "object", root: true, description: "Return value"
    },
    http: { verb: "post" }
  });

  Account.changePasswordInside = async function (id, data, options) {
    // payload {id: "string"} data: {oldPass: "string", newPass: "string"}
    const Email = Account.app.models.Email;

    try {
      var patha = path.resolve(__dirname, '../../server/views/changepassword.ejs');
      var str = fs.readFileSync(patha, 'utf8');

      var constraints = {
        oldPass: {presence: true},
        newPass: {presence: true}
      };

      var validation = validate(data, constraints);
      if (validation) return Promise.reject({status: "error",data: validation});

      var account = await Account.findById(id);
      var changePass = await Account.changePassword(id, data['oldPass'], data['newPass']);
      var messageHtml = ejs.render(str, {password: data['newPass'], is_force:false});

      Email.send({
        to: account['email'],
        // from: "cust.support@medicaboo.com",
        from: localConfig.email,
        subject: "Medicaboo - Password Changed",
        html: messageHtml
      }, function (err) {
        if (err) {
          console.log(err);
        }
      });
      return Promise.resolve({status: "success"});
    } catch (err) {
      return Promise.reject(err);
    }
  };

  Account.remoteMethod("changePasswordInside", {
    description: ["change password"],
    accepts: [
      {arg: "id", type: "string", http: {source: 'path'}, required: true, description: "Id"},
      {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "data"},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
      arg: "status", type: "object", root: true, description: "Return value"
    },
    http: {verb: "put", path: "/:id/changePasswordInside"}
  });

  Account.getListStaff = async function (filter, skip, limit, sort, options) {
    // payload: {placeId: "string", search: "string"}

    try {
      const ConfigAccount = Account.app.models.ConfigAccount;

      const token = options && options.accessToken;
      if (!token) return Promise.resolve({status:"error",data:"Please login to access this feature"});
      const userId = token && token.userId;
      if (!userId) return Promise.resolve({status:"error",data:"Where do you get this authentication"});

      var constraints = {
        placeId: {presence: true}
      };

      var validation = validate(filter, constraints);
      if (validation) return Promise.resolve({status:"error",data:validation});

      var query = {
        placeId: filter['placeId']
      };
      sort = sort || "name ASC";

      if (filter.hasOwnProperty('search')) {
        query['name'] = {like: filter['search'], options: "i"};
      }

      var account = await ConfigAccount.find({where: query, skip: skip, limit: limit, order: sort,
        fields: ['id','accessId','accountId','occupationId','placeId','Confidentials','RoleActions','name','isActive'],
        include: [{
            relation: 'RoleActions',
            scope: {
              fields: {'name' : true, 'id': true}
            }
          },{
            relation: 'Confidentials',
            scope: {
              fields: {'hp' : true, 'email':true}
            }
          }]});
      var totalItem = await ConfigAccount.count(query);

      return Promise.resolve({status: "success", items: account, count: totalItem});
    } catch (err) {
      return Promise.reject(err);
    }
  };

  Account.remoteMethod("getListStaff", {
    description: ["Get list of staff"],
    accepts: [
      { arg: "filter", type: "object", required: true, description: "filter" },
      { arg: "skip", type: "number", required: false, description: "skip" },
      { arg: "limit", type: "number", required: false, description: "limit" },
      { arg: "sort", type: "string", required: false, description: "sort" },
      { arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
      arg: "status", type: "object", root: true, description: "Return value"
    },
    http: {verb: "get", path: "/getListStaff"}
  });

  Account.getDetailStaff = async function (id, options) {
    try {
      const ConfigAccount = Account.app.models.ConfigAccount;
      const token = options && options.accessToken;
      if (!token) return Promise.reject({status:"error",data:"Please login to access this feature"});
      const userId = token && token.userId;
      if (!userId) return Promise.reject({status:"error",data:"You have no access to this feature"});
      if (!id) return Promise.reject({status:"error",data:"Id is missing"});

      var configAccount = await ConfigAccount.findById(id, {include: [{
          relation: 'RoleActions',
          scope: {
            fields: {'name' : true, 'id': true}
          }
        },{
          relation: 'Confidentials',
          scope: {
            fields: {'hp' : true, 'email':true, 'username': true}
          }
        }]});

      if (configAccount == null) {
        ({status: "error", data: "Id account & config for this staff is not match"});
      }

      if (configAccount != null) {
        return Promise.resolve({status: "success", item: configAccount});
      } else {
        return Promise.reject({status: "error", data: "Please make sure your id is right"});
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  Account.remoteMethod(
    "getDetailStaff", {
    description: ["Get detail Rack by provided id"],
    accepts: [
      {arg: "id", type: "string", http: {source: 'path'}, required: true, description: "Sample id : 5f9e731ca9ed946cfd1d04a0"},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    returns: {
      arg: "status", type: "object", root: true, description: "Return Rack"
    },
    http: {verb: "get", path: "/:id/getDetailStaff"}
  });

  Account.inviteMember = async function (data, options) {
    //IDEA create Account
    //IDEA check if email is existed, send email invitation to user,
    //IDEA so user click the invitation and then kamarmedis will hit back to services
    //IDEA to set active and set data accountId
    //IDEA if email not existed, register to Masyarakat and Role, and then
    //IDEA send email to user to show generated password and invitation message
    //IDEA so user click the invitation and then hit services and then set active and set data accountId
    //IDEA both need to do login first to proceed
    // payload: {configId: "string", occupationId: "string", accessId: "string",
    // email: "string", username: "string", hp: "string (not required)", notes: "string (not required)"}

    const Place = Account.app.models.Place;
    const Email = Account.app.models.Email;
    const Config = Account.app.models.Config;
    const ConfigAccount = Account.app.models.ConfigAccount;
    const Occupation = Account.app.models.Occupation;
    const AccessRight = Account.app.models.AccessRight;

    var updaterUserId, id, updatedName, user, validation, constraints, dataUser = {},
    configAccount, encryptToken, specificUser, pathEmailExist, pathEmailRegister,
    fsEmailExist, fsEmailRegister, url, messageHtml, objectName, hospital, doctor,
    emailConfig;

    try {
      const token = options && options.accessToken;
      if (!token) return Promise.reject({status:"error",data:"Please login to access this feature"});
      const userId = token && token.userId;
      if (!userId) return Promise.reject({status:"error",data:"You have no access to this feature"});
      var inviteeAccount = await Account.findById(userId);

      constraints = {
        configId: {presence: true},
        occupationId: {presence: true},
        accessId: {presence: true}, //masteradmin, admissi, cashier, apotek, doctor, nurse
        email: {presence: true},
        username: {presence: true}
      };

      validation = validate(data, constraints);
      if (validation) return Promise.reject({status:"error",data: validation});

      dataUser['email'] = data['email'];
      delete data['email'];
      dataUser['username'] = data['username'];
      delete data['username'];
      if (data.hasOwnProperty("hp")) {
        dataUser['hp'] = data['hp'];
        delete data['hp'];
      }

      specificUser = await Account.find({where: {email: dataUser['email'], username: dataUser['username']}});
      if (specificUser.length > 0) {
        data['accountId'] = specificUser[0]['id'];
        data['accountToken'] = utils.makeToken();

        //NOTE send email to existing user
        pathEmailExist = path.resolve(__dirname, '../../server/views/invitation-existed.ejs');
        fsEmailExist = fs.readFileSync(pathEmailExist, 'utf8');

        if (process.env.NODE_ENV == 'production') {
          url = 'https://warehouse-ibbr.assist.id/invitation?token='+ data['accountToken'];
        } else {
          url = 'https://devwarehouseibbr.reqaid.com/invitation?token='+ data['accountToken'];
        }

        messageHtml = ejs.render(fsEmailExist, {url: url, objectName: "staff"});
      } else {
        const todayMomentJkt = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

        dataUser['name'] = data['name'];
        dataUser['code'] = new Date().getTime();
        dataUser['createdId'] = userId;
        dataUser['createdDate'] = new Date(todayMomentJkt);
        dataUser['createdName'] = inviteeAccount['name'];
        dataUser['isActive'] = true;
        dataUser['created_date'] = new Date;
        dataUser['emailVerified'] = true;
        dataUser['password'] = utils.makePass();
        user = await Account.create(dataUser);

        data['accountId'] = user['id'];
        data['accountToken'] = utils.makeToken();

        //NOTE send email to registered user
        pathEmailRegister = path.resolve(__dirname, '../../server/views/invitation-registered.ejs');
        fsEmailRegister = fs.readFileSync(pathEmailRegister, 'utf8');

        if (process.env.NODE_ENV == 'production') {
          url = 'https://warehouse-ibbr.assist.id/invitation?token='+ data['accountToken'];
        } else {
          url = 'https://devwarehouseibbr.reqaid.com/invitation?token='+ data['accountToken'];
        }

        messageHtml = ejs.render(fsEmailRegister, {url: url, password: dataUser['password'], objectName: objectName});
      }

      var occupation = await Occupation.findById(data['occupationId']);
      var access = await AccessRight.findById(data['accessId']);
      data['occupation'] = occupation['name'];
      data['access'] = access['name'];
      configAccount = await ConfigAccount.create(data);
      emailConfig ={
        to: dataUser['email'],
        // from: "Medicaboo Customer Support",
        from: localConfig.email,
        subject: "Medicaboo - Invitation Kamarmedis",
        html: messageHtml
      };

      await Email.send(emailConfig);
      return Promise.resolve({status: "success", config: configAccount, user: user});
    } catch (err) {
      return Promise.reject(err);
    }
  };

  Account.remoteMethod(
      "inviteMember", {
        description: [""],
        accepts: [
          {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "data"},
          {arg: "options", type: "object", http: "optionsFromRequest"}
        ],
        returns: {
          arg: "status", type: "object", root: true, description: "Return value"
        },
        http: {verb: "post", path: "/inviteMember"}
      }
  );

  Account.editStaff = async function (id, data, options) {
    // payload: {id: "string"}, data: {name: "string", occupationId: "string", occupation: "string",
    // accessId: "string", access: "string", hp: "string", notes: "string", isActive: "boolean"}

    const Place = Account.app.models.Place;
    const Email = Account.app.models.Email;
    const Config = Account.app.models.Config;
    const ConfigAccount = Account.app.models.ConfigAccount;

    var updaterUserId, id, updatedName, user, validation, constraints, dataUser = {},
    configAccount, encryptToken, specificUser, pathEmailExist, pathEmailRegister,
    fsEmailExist, fsEmailRegister, url, messageHtml, objectName, hospital, doctor,
    emailConfig;

    try {
      const token = options && options.accessToken;
      if (!token) return Promise.reject({status:"error",data:"Please login to access this feature"});
      const userId = token && token.userId;
      if (!userId) return Promise.reject({status:"error",data:"You have no access to this feature"});
      var inviteeAccount = await Account.findById(userId);

      var configAccount = await ConfigAccount.findById(id);
      if (!configAccount) return Promise.reject({status:"error",data:"No data[1]"});
      var account = await Account.findById(configAccount['accountId']);
      if (!account) return Promise.reject({status:"error",data:"No data[2]"});

      if (data.hasOwnProperty('name')) configAccount['name'] = data['name'];
      if (data.hasOwnProperty('notes')) configAccount['notes'] = data['notes'];
      if (data.hasOwnProperty('accessId')) {
        configAccount['accessId'] = data['accessId'];
        configAccount['access'] = data['access'];
      }
      if (data.hasOwnProperty('occupationId')) {
        configAccount['occupationId'] = data['occupationId'];
        configAccount['occupation'] = data['occupation'];
      }
      if (data.hasOwnProperty('isActive')) {
        configAccount['isActive'] = data['isActive'];
      }
      await configAccount.save();

      if (data.hasOwnProperty('hp')) account['hp'] = data['hp'];
      await account.save();

      return Promise.resolve({status: "success", config: configAccount, user: user});
    } catch (err) {
      return Promise.reject(err);
    }
  };

  Account.remoteMethod("editStaff", {
        description: ["Return updated id"],
        accepts: [
          {arg: "id", type: "string", http: {source: 'path'}, required: true, description: "Id 5fa26188bd67d3df5407d018"},
          {arg: "data", type: "object", http: {source: 'body'}, required: true, description: "name, namePic, hpPic, address (object => street, region, city, district, postcode)"},
          {arg: "options", type: "object", http: "optionsFromRequest"}
        ],
        returns: {
          arg: "status", type: "object", root: true, description: "Return value"
        },
        http: {verb: "put", path: "/:id/editStaff"}
      }
  );

  Account.afterRemote('inviteMember', function (context, user, next) {
    var users = context.result, principalId;
    if (users['status'] == "error") return next();
    principalId = user['config']['accountId'];

    Account.getApp(function (err, app) {
      app.models.Role.findOrCreate({
        name: 'warehouseUser'
      }, function (err, role) {
        if (err) throw err;

        role.principals({where: {principalType: app.models.RoleMapping.USER, principalId: principalId}},
          function (err, exist) {
            if (err) throw err;

            if (exist.length == 0) {
              role.principals.create({
                principalType: app.models.RoleMapping.USER,
                principalId: principalId
              }, function (err, principal) {
                if (err) throw err;
                return next();
              });
            } else {
              return next();
            }
          });
      });
    });
  });

  Account.confirmInvitation = async function (token, options) {
    //IDEA check token is right
    //IDEA change active = true
    // payload: {token: "string"}
    const ConfigAccount = Account.app.models.ConfigAccount;
    var updaterUserId, id, updatedName, user, validation, constraints, dataUser = {},
    configAccount, encryptToken, specificUser, objectName, hospital, doctor, activeConfigAccount;

    try {
      activeConfigAccount = await ConfigAccount.find({where:{accountToken: token}});
      if (activeConfigAccount.length > 0) {
        accountId = activeConfigAccount[0]['accountId'];
        if (accountId == null) return Promise.reject({status: "error", data: "Token anda expired, minta admin tim anda untuk invite ulang"});
        user = await Account.updateAll({id: accountId}, {emailVerified: true});
        configAccount = await ConfigAccount.updateAll({accountToken: token}, {active: true});
      } else {
        return Promise.reject({status: "error", data: "Token anda tidak sesuai, minta admin tim anda untuk invite ulang"});
      }

      return Promise.resolve({status: "success", config: configAccount, user: user});
    } catch (err) {
      return Promise.reject(err);
    }
  };

  Account.remoteMethod("confirmInvitation", {
        description: [""],
        accepts: [
          {arg: "token", type: "string", required: true, description: ""}
        ],
        returns: {
          arg: "status", type: "object", root: true, description: "Return value"
        },
        http: {verb: "get", path: "/confirmInvitation"}
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

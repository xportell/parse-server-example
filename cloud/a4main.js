console.log('Loading cloud.....');
console.log( 'clodu code:' + __dirname);

//Use Parse.Cloud.define to define as many cloud functions as you want.
//For example:
var _ = require('./underscore.js')

Parse.Cloud.define("getTags", function(request,response){
	var tags =request.params.tags;
	console.log('tags',tags);
	
	var classNames = [
		"Forum",
		"Event",
		"Postv2",
		"Surveys"
	];

	Activity = Parse.Object.extend("Activity");
	
	var orArgs = classNames.map(function(item){
		var innQuery = new Parse.Query(item);	
		var subQuery = new Parse.Query(Activity);
		return subQuery.matchesQuery("childs", innQuery.containsAll('tags',tags));
	});

	
	var query = Parse.Query.or.apply(this, orArgs);
	query.include("childs");
	query.include("childs.author");
	
	query.find({
		  success: function(activities) {
				response.success(activities);
		  }, function(error) {
		      // The file either could not be read, or could not be saved to Parse.
		      console.log("Error in requesting tags:" + JSON.stringify(error));
		      response.error(error);
		  }
		});
});

Parse.Cloud.define("UploadImageAndGetURL", function(request, response) {

  var fileName = request.params.fileName;
  var base64 = request.params.base64EncodedImageString;

  var file = new Parse.File(fileName, { base64: base64 });

  file.save(null, {useMasterKey:true}).then(function(fileObject) {
      // The file has been saved to Parse.
      var photoURL = fileObject.url();
      var photoName = fileObject.name();
      console.log("Photo" + photoName +  " saved successfully with URL:" + photoURL);
      response.success({
      	name: photoName,
      	url: photoURL
      });
    }, function(error) {
      // The file either could not be read, or could not be saved to Parse.
      console.log("The file either could not be read, or could not be saved to Parse:" + JSON.stringify(error));
      response.error(error);
  });

});

function updateActivity(request, response){
	var type = request.object.className;
	var item = {
     		"__type": "Pointer",
     		"className": type,
     		"objectId": request.object.id,
 	};
 		
	Activity = Parse.Object.extend("Activity");
	var activity = new Activity;

	if(request.object.attributes.parent) activity.set("id",request.object.attributes.parent.id);
	else activity.set("type", type);
	activity.addUnique("childs", item);
	
	if(request.object.attributes.ACL)  activity.setACL(genACL(request.object.attributes.ACL));


	activity.save(null,{
	  success: function(activity) {
	    response.success(activity);
	  },
	  error: function(activity, error) {
	     response.error(error);
	  }
	});

}

function genACL(item){
	var acl = new Parse.ACL();
	acl.setPublicReadAccess(true);
        acl.setPublicWriteAccess(false);
	for(var prop in item.permissionsById) {
		if(prop!='*'){
			acl.setReadAccess(prop, item.permissionsById[prop].read);
			acl.setWriteAccess(prop, false);	
		}
		else if (prop=='*'){
			acl.setPublicReadAccess(item.permissionsById[prop].read);
		        acl.setPublicWriteAccess(false);
		}
	}
	console.log('-----acl:', acl);
	return acl;
}

Parse.Cloud.afterSave("Post",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
}); 

Parse.Cloud.afterSave("Comment",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Like",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Note",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterDelete("Like",function(request, response) {
	var like = {
		"__type":"Pointer",
		"className":"Like",
		"objectId": request.object.id,
		};
	Activity = Parse.Object.extend("Activity");
	var activity = new Activity;	
	activity.set('id', request.object.attributes.parent);	 
		activity.remove("childs", like);
		activity.save(null,{
		  success: function(post) {
		    // save succeeded
		  },
		  error: function(post, error) {
		    // inspect error
		  }
		});
});


Parse.Cloud.afterDelete("dtest", function(request, response){
	console.log(request);
	console.log(response);
	response.error(request);
});

Parse.Cloud.afterSave("dtest", function(request, response){
	console.log(request);
	response.error('hi joe!');
});


Parse.Cloud.beforeDelete("Post", function(request, response) {
	var target = {"__type":"Pointer","className":"Post","objectId":request.object.id};
  query = new Parse.Query("Activity");
  //query.include("childs");
  query.equalTo("childs", target);
  query.equalTo("parent",undefined);
  query.find({
    success: function(activities) {
	var objects = [];
	console.log(activities);
	//for (var i = 0; i < activities.length; i++) {
	for (var i = 0; i < 1; i++) {
	      var activity = activities[i];
	      var n = activity.get("childs");
	      console.log(n);
	      for(var j = 0; j < n.length; j++){
	      	if(n[j].id != target.objectId){
		      	var DObject = Parse.Object.extend(n[j].className);
			var object = new DObject;
			object.set('id', n[j].id);
			objects.push(object);	
	      	}
	      }
	      console.log(activity.className);
	      console.log(activity.id);
	      var Base = Parse.Object.extend(activity.className);
	      var object = new Base;
	      object.set('id', activity.id);
	      objects.push(object);	
	 }
	 
      	//response.error(objects);
        Parse.Object.destroyAll(objects).then(function(success) {
	  response.success();
	}, function(error) {
	  response.error("Error " + error.code + " : " + error.message + " when deleting activity.");
	});
      
    },
    error: function(error) {
      response.error("Error " + error.code + " : " + error.message + " when deleting activity.");
    }
  });
});

Parse.Cloud.define('hello', function(req, res) {
	console.log('hello', req);
  res.success('Hi');
});


Parse.Cloud.define("isMe", function(request, response) {
		var Profile = Parse.Object.extend("Profile");
		var query = new Parse.Query(Profile);

		
		query.equalTo("objectId", request.params.profileId);
		query.first().then(function(object){
			 console.log(object.attributes.user.id);
			 console.log(request.user.id);
			 if(object.attributes.user.id == request.user.id) response.success('Wellcome');
			 else response.error('Realy?');
		});	
});


Parse.Cloud.define("signupAsBasicUser", function(request, response) {
	console.log('signupAsBasicUser2 init',request);
	var postParams = request.body;
	console.log(postParams);
	//console.log(request.params);
	console.log(request.params.username);
	console.log(request.params.email);
	console.log(request.params.password);
	console.log(request.params.profile);
	
	signupAsBasicUser(request.params.username, request.params.password, request.params.email).then(function(user) {
		
		response.success(user);
		
     		/*var Profile = Parse.Object.extend("Profile");
		var profile = new Profile;
		
		var pUser = {
                            "__type": "Pointer",
                            "className": "_User",
                            "objectId": user.object.objectId
		};
		
		profile.set("user", pUser);
		profile.set("organitzation", request.params.profile.organitzation);
		profile.set("surnames", request.params.profile.surnames);
		console.log(profile);
		profile.save({ useMasterKey: true },{
				sucess: function(profile){
				//save succeeded
				response.success(user);
				},
				error: function(profile, error){
				//	inspect error
				}
			});*/
     		
     		//response.success(user);
 	}, function(error) {
     		response.error(error);
	 });
});

//return a promise fulfilled with a signed-up user who is added to the 'Basic User" role
//
function signupAsBasicUser(name, password, email) {

 var user = new Parse.User();
 console.log('name '+ name);
 console.log('pass: '+password);
 console.log('email: '+email);
 user.set("username", name);
 user.set("password", password);
 user.set("email", email);
 console.log(user);
 console.log('------Abans del user.signUp------');
 return user.signUp(null, {useMasterKey: true}).then(function() {
	  console.log('------Signup fet------');
     var query = new Parse.Query(Parse.Role);
     query.equalTo("name", 'user');
     console.log('-----return query.find------');
     return query.find();
 }).then(function(roles) {
     if (roles.length < 1) return Parse.Promise.error("no such role");
     roles[0].getUsers().add(user);
     console.log('-----dins el then function 1------');
     return roles[0].save();
 }).then(function() {
 	console.log('------dins el then function 2, return user------');
     return user;
 });
}

//return a promise fulfilled with a signed-up user who is added to the 'Basic User" role
//
function signupAsBasicUser(name, password, email) {
 var user = new Parse.User();
 console.log('name '+ name);
 console.log('pass: '+password);
 console.log('email: '+email);
 user.set("username", name);
 user.set("password", password);
 user.set("email", email);
 console.log(user);
 console.log('------Abans del user.signUp------');
 return user.signUp().then(function() {
     var query = new Parse.Query(Parse.Role);
     query.equalTo("name", 'BasicUser');
     console.log('-----return query.find------');
     return query.find();
 }).then(function(roles) {
     if (roles.length < 1) return Parse.Promise.error("no such role");
     roles[0].getUsers().add(user);
     console.log('-----dins el then function 1------');
     return roles[0].save();
 }).then(function() {
 	console.log('------dins el then function 2, return user------');
     return user;
 });
}



/**
* NOTIFICATIONS FUNCTIONS (ON TEST)
*/
Parse.Cloud.define("push", function(request, response) {
	var query = new Parse.Query("Post");
	
	 query.get(request.params.objectId, {
	    success: function(post) {
	      post.increment("push");
	      var text = post.get("text");
	      post.save();
	      var queryPush = new Parse.Query(Parse.Installation);
		  //query.notEqualTo("installationId", post.installationID);
		  queryPush.equalTo('channels', 'NewPosts2');
		  console.log(text);
		  Parse.Push.send({
			  where: queryPush, // Set our Installation query
			  data: {
			    alert: text,
			  }
			}, {
			  success: function(post) {
				  response.success(request.params.objectId);
				
			  },
			  error: function(error) {

			  }
			});
	    },
	    error: function(error) {
	      console.error("Got an error " + error.code + " : " + error.message);
	    }
	 });
	  
});

console.log('Loading cloud.....');
console.log( 'clodu code:' + __dirname);

//Use Parse.Cloud.define to define as many cloud functions as you want.
//For example:
var _ = require('./underscore.js')

Parse.Cloud.define("getTags", function(request,response)){
	Activity = Parse.Object.extend("Activity");
	var activity = new Activity;

	var query = new Parse.Query(Activity);

	query.find({
		  success: function(activities) {
		   response.success(activities);
		  }, function(error) {
	      // The file either could not be read, or could not be saved to Parse.
	      console.log("Error in requesting tags:" + JSON.stringify(error));
	      response.error(error);
  });
}

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
	console.log('update-activity');
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
	console.log('AQUI GUARDEM ITEM_______________________-');
	console.log(item);

	activity.save(null,{
	  success: function(activity) {
	    response.success(activity);
	  },
	  error: function(activity, error) {
	     response.error(error);
	  }
	});

}

Parse.Cloud.afterSave("Postv2",function(request, response) {
	//console.log(request);
	//console.log(request.object);
	console.log(response);
	console.log(request.object.attributes.updatedAt);
	console.log(request.object.attributes.createdAt);
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
}); 

Parse.Cloud.afterSave("Commentv2",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Like",function(request, response) {
	console.log('Like');
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


Parse.Cloud.beforeDelete("Postv2", function(request, response) {
	var target = {"__type":"Pointer","className":"Postv2","objectId":request.object.id};
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


Parse.Cloud.define("signupAsBasicUser2", function(request, response) {
	console.log('signupAsBasicUser2 init',request);
	var postParams = request.body;
	console.log(postParams);
	//console.log(request.params);
	console.log(request.params.username);
	console.log(request.params.email);
	console.log(request.params.password);
	console.log(request.params.profile);
	
	signupAsBasicUser2(request.params.username, request.params.password, request.params.email).then(function(user) {
		
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
function signupAsBasicUser2(name, password, email) {
 console.log('Dins de signup funció local');
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

Parse.Cloud.define("signupAsBasicUser", function(request, response) {
	console.log(request);
	var postParams = request.body;
	console.log(postParams);
	signupAsBasicUser(request.params.username, request.params.password, request.params.email).then(function(user) {
     response.success(user);
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

Parse.Cloud.afterSave("Post",function(request) {
	var post = {
		"text": request.object.attributes.text ||"",
		"comments": request.object.attributes.comments || [],
		"photo": request.object.attributes.photo || "",
		"likes": request.object.attributes.likes || [],
	};
	var type = "post";
	console.log('Actualitzant timeline!')
	var dir = request.object.attributes.profile;
	var refid = request.object.id;
	var Timeline = Parse.Object.extend("Timeline");
	var timeline = new Timeline;
	var query = new Parse.Query('Timeline');
	console.log('prova1');
	query.equalTo("refId", refid);
	query.find({
  		success: function(results) {
  			console.log('prova2');
  			console.log(results)
    			if (results.length > 0){
    				timeline.set("id", results[0].id);
    				console.log('he entrat');
    			}
    			query.count({ useMasterKey: true }) // count() will use the master key to bypass ACL
  				.then(function(count) {
      				response.success(count);
    			});
    			console.log('prova3');
			timeline.set("metadata",post);
			timeline.set("type", type);
			timeline.set("refId", refid);
			timeline.set("direction", dir);
			console.log('prova4');
			timeline.save(null,{
				sucess: function(timeline){
				//save succeeded
				},
				error: function(timeline,error){
				//	inspect error
				}
			});
  		},
  		error: function(error) {
    			 
  		}
	});

});  

/*Parse.Cloud.afterSave("Like", function(request) {
	
	var like = {
     "__type": "Pointer",
     "className": "Like",
     "objectId": request.object.id,
 };

	var Post = Parse.Object.extend("Post");
	var post = new Post();
	post.set('id', request.object.attributes.postId.id);
	//console.log(post);
	Parse.Cloud.useMasterKey();
	post.addUnique("likes", like);
	post.save(null,{
	  success: function(post) {
	    // save succeeded
	  },
	  error: function(post, error) {
	    // inspect error
	  }
	});
});

Parse.Cloud.afterDelete("Like", function(request) {
	var like = {
	        "__type": "Pointer",
	        "className": "Like",
	        "objectId": request.object.id,
	    };

		var Post = Parse.Object.extend("Post");
		var post = new Post();
		post.set('id', request.object.attributes.postId.id);	 
		post.remove("likes", like);
		post.save(null,{
		  success: function(post) {
		    // save succeeded
		  },
		  error: function(post, error) {
		    // inspect error
		  }
		});
}); */


Parse.Cloud.afterSave("Comment", function(request) {
	
	var comment = {
     		"__type": "Pointer",
     		"className": "Comment",
     		"objectId": request.object.id,
 	};

	var Post = Parse.Object.extend("Post");
	var post = new Post();
//	var Timeline = Parse.Object.extend("Timeline");
//	var timeline = new Timeline();
	console.log('HOLA1');
	//Parse.Cloud.useMasterKey();
	post.set('id', request.object.attributes.postId.id);	 
	post.addUnique("comments", comment);
	post.save(null,{
	  success: function(post) {
	    // save succeeded
	  },
	  error: function(post, error) {
	    // inspect error
	  }
	});
	console.log('Hola2');
});

Parse.Cloud.afterDelete("Comment", function(request) {
	var like = {
	        "__type": "Pointer",
	        "className": "Comment",
	        "objectId": request.object.id,
	    };

		var Post = Parse.Object.extend("Post");
		var post = new Post();
		post.set('id', request.object.attributes.postId.id);	 
		post.remove("comments", like);
		post.save(null,{
		  success: function(post) {
		    // save succeeded
		  },
		  error: function(post, error) {
		    // inspect error
		  }
		});
});



Parse.Cloud.define("getTimeline", function(request, response) {
	var Timeline = Parse.Object.extend("Post");
	var query = new Parse.Query(Timeline);

	query.include("profile");
	return query.find(function(results) {
			var posts = [];
			var aLikes = [];
			
		  	//Fetch all postsIDs to search
		  	var postLikesIDs = [];
		  	var postCommentsIDs = [];
		  	var postIDsIndex = [];
		  	
		  	_.each(results, function(result, i) {	
		  		postLikesIDs.push({	"__type": "Pointer", "className": "Post", "objectId": result.id });
		  		postCommentsIDs.push({	"__type": "Pointer", "className": "Post", "objectId": result.id });
		  		postIDsIndex[result.id] = i;
		  	});

		  	var Likes = Parse.Object.extend("Like");
		  	var Comments = Parse.Object.extend("Comment");
		  	var queryLikes = new Parse.Query(Likes);
		  	var queryComments = new Parse.Query(Comments);	
		  	queryLikes.containedIn("postId", postLikesIDs);
		  	queryLikes.include('profileId');
		  	queryComments.containedIn("postId", postCommentsIDs);
		  	queryComments.include('profileId');
		  	
		  	var promiseLikes = queryLikes.find().then(function(likeResults) {
		  		_.each(likeResults, function(likes, i) {	
		  			var tmp = []; 
		  			
		  			if(typeof results[postIDsIndex[likes.attributes.postId.id]].attributes.likes === "undefined"){
		  				//console.log('like undefined');
		  					tmp.push(likes);
		  			}
		  			else{
		  				tmp = results[postIDsIndex[likes.attributes.postId.id]].attributes.likes;
		  				tmp.push(likes);
		  			}

		  			results[postIDsIndex[likes.attributes.postId.id]].attributes.likes = tmp;
			  	});
		  		return results;

			});
		  	
		  	var promiseComments = queryComments.find().then(function(commentResults) {
		  		//console.log(commentResults);
		  		_.each(commentResults, function(comments, i) {	
		  			var tmp = []; 
			  		//console.log(results);
		  			//console.log(results[postIDsIndex[comments.attributes.postId.id]].attributes.comments);
	  				//console.log(typeof results[postIDsIndex[comments.attributes.postId.id]].attributes.comments);
		  			
	  				tmp.push(comments);

		  			results[postIDsIndex[comments.attributes.postId.id]].attributes.comments = tmp;
		  			
			  	});
		  		return results;
			});
		  	
		  	Parse.Promise.when([promiseLikes,promiseComments]).then(function(wait){
		  		response.success(results);
		  	});

		},
		function(error){
			response.error("ERROR in getTimeline");
		});	
	
	
});
//aqui2

Parse.Cloud.define("publish", function(request, response) {
	//var Post = Parse.Object.extend("Post");
	//var post = new Post();
	var post = new Parse.Object("Post",request.params);

	
	
	post.save(null,{
	  success: function(requestpush) {
		  var query = new Parse.Query(Parse.Installation);
		  //query.notEqualTo("installationId", request.params.installationID);
		  query.equalTo('channels', 'NewPosts2');

			  
		  Parse.Push.send({
			  where: query, // Set our Installation query
			  data: {
			    alert: request.params.text
			  }
			}, {
			  success: function(post) {
			    // Push was successful
				
			  },
			  error: function(error) {

			  }
			});
		  response.success(post);
	  },
	  error: function(post, error) {
		  response.error("ERROR saving post");
	  }
	});
});

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

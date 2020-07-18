
const https = require('https');
var jszip = require('jszip');
const aws = require('aws-sdk');
const s3 = new aws.S3({httpOptions: { timeout: 30000 }});
const codepipeline = new aws.CodePipeline();

const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({
    "auth": process.env["GH_TOKEN"]
});


function putJobSuccess(message, jobId) {
    console.log('Post Job Success For JobID: '.concat(jobId));
    const params = {
        jobId: jobId
    };

    return codepipeline.putJobSuccessResult(params).promise()
        .then(() => {
            console.log(`Post Job Success Succeeded Message: ${message}`);

            return message;
        })
        .catch((err) => {
            console.log(`Post Job Failure Message: ${message}`);

            throw err;
        });
}

exports.handler = async (event) => {
    
    var inputArtifacts = event["CodePipeline.job"]["data"]["inputArtifacts"];
    
    console.log(inputArtifacts[0]);
    
    for (var i = 0; i < inputArtifacts.length; i++)
    {
        var artifact = inputArtifacts[i];
        
        console.log(artifact);
        
        if (artifact["location"].hasOwnProperty("s3Location")){
            
            var s3Location = artifact["location"]["s3Location"];
            
            console.log(s3Location);
            
            try {
                console.log("Trying to get s3 data");
                
                var artifactData = await s3.getObject({
                    Bucket: s3Location["bucketName"],
                    Key: s3Location["objectKey"]
                }).promise();
                
                console.log("File read");
                
                var zip = await jszip.loadAsync(artifactData.Body);
                
                console.log("unzipping");
                console.log(zip);
                
                var version = await zip.file("version.txt").async("string");
                version = version.replace(/(\r\n|\n|\r)/gm,"");
                console.log(version);
                
                var answer = await octokit.repos.createRelease({
                    "owner": "stonkie",
                    "repo": "RaspberrySour",
                    "name": version,
                    "tag_name": version,
                    "target_commitish": "master",
                    "body": "Development build",
                    "prerelease": true
                });
      
                for(var fileName in zip.files) {
                    console.log("File : " + fileName);
                    
                    var file = zip.file(fileName);
                    
                    if (file["name"] != "version.txt")
                    {   
                        console.log("Uploading : " + file["name"]);
                        
                        console.log("Getting file");
                        
                        var fileData = await zip.file(file["name"]).async("nodebuffer");
                        
                        console.log("Uploading");
                        
                        var uploadAnswer = await octokit.repos.uploadReleaseAsset({
                            "owner": "stonkie",
                            "repo": "RaspberrySour",
                            "release_id": answer["data"]["id"],
                            "name": file["name"],
                            "data": fileData
                        });
                        
                        console.log(uploadAnswer);
                    }
                }
            } 
            catch (error) {
                console.log(error);
                return;
            }
        }
        else {
            console.log("Artifact does not have the correct property");
        }
    }
    
    // var result = await putJobSuccess("done", event["CodePipeline.job"].id);
    // console.log(result);
        
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};

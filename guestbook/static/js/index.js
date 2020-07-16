 window.presigned_url = null;

/*
  Function to carry out the actual POST request to S3 using the signed request from the Python app.
*/
function uploadFile(file, s3Data){
  const xhr = new XMLHttpRequest();
  xhr.open('POST', s3Data.url);
  xhr.setRequestHeader('x-amz-acl', 'public-read');

  const postData = new FormData();
  for(key in s3Data.fields){
    postData.append(key, s3Data.fields[key]);
  }
  postData.append('file', file);

  xhr.onreadystatechange = () => {
    if(xhr.readyState === 4){
      if(xhr.status === 200 || xhr.status === 204){
        console.log("Upload complete for file! object key:", s3Data.fields.key)
      }
      else{
        alert('Could not upload file.');
      }
    }
  };
  xhr.send(postData);
}

/*
  Function to get the temporary signed request from the Python app.
  If request successful, continue to upload the file using this signed
  request.
*/
function getSignedRequestAndUploadFile(key, file){
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/sign-s3?file-name=${key}&file-type=${file.type}`);
  xhr.onreadystatechange = () => {
    if(xhr.readyState === 4){
      if(xhr.status === 200){
        const response = JSON.parse(xhr.responseText);
        window.presigned_url = response.presigned_url;
        console.log("The /sign-s3 RESPONSE:", response, "for key:", key);
        uploadFile(file, response.s3Data);
      }
      else{
        alert('Could not get signed URL.');
      }
    }
  };
  xhr.send();
}

function getFile() {
  const files = document.getElementById('file-input').files;
  return files[0];
}

function setFormDataForFile() {

  const file = getFile();

  if (!file) {
    return console.log('No file selected.');
  }

  // Set needed data on the form to be sent to the server
  document.getElementById('filetype').value = file.type;
  document.getElementById('filename').value = file.name;
}



function submitButtonEventListener(event) {
  event.preventDefault();


  const formElement = document.querySelector('#entry-submit-form');
  const formData = new FormData(formElement);
  const submitUrl = '/submit-form/';
  const xhr = new XMLHttpRequest();

  xhr.open('POST', submitUrl);
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        console.log("HERE IS THE SUBMIT RESPONSE", response);

        const file = getFile();
        if (!file) {
          return;
        }

        getSignedRequestAndUploadFile(response.s3_object_key, file)

      } else {
        console.log("Something went wrong when trying to submit");
      }
    }
  };

  xhr.send(formData);
}

/*
   Bind listeners when the page loads.
*/
(() => {
  document.querySelector('#file-input').onchange = setFormDataForFile;
  document.querySelector('#entry-submit-button').addEventListener('click', submitButtonEventListener);
})();
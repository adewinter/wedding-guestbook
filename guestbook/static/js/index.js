 window.presigned_url = null;

/*
  Function to carry out the actual POST request to S3 using the signed request from the Python app.
*/
function uploadFile(file, s3Data, url){
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
        document.getElementById('preview').src = window.presigned_url;
        document.getElementById('avatar-url').value = window.presigned_url;
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
function getSignedRequest(file){
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/sign-s3?file-name=${file.name}&file-type=${file.type}`);
  xhr.onreadystatechange = () => {
    if(xhr.readyState === 4){
      if(xhr.status === 200){
        const response = JSON.parse(xhr.responseText);
        window.presigned_url = response.presigned_url;
        console.log("The presigned URL is:", window.presigned_url);
        uploadFile(file, response.data, response.url);
      }
      else{
        alert('Could not get signed URL.');
      }
    }
  };
  xhr.send();
}

function setFormDataForFile() {

  const files = document.getElementById('file-input').files;
  const file = files[0];

  if (!file) {
    return console.log('No file selected.');
  }

  // Set needed data on the form to be sent to the server
  document.getElementById('filetype').value = file.type;
  document.getElementById('filename').value = file.name;

  window.somef = files;
  console.log("HERE IS THE FILE", file);
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
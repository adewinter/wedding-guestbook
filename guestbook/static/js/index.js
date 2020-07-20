let XHR_ERROR_MESSAGE = '';

const SPINNER_OPTIONS = {
  lines: 20, // The number of lines to draw
  length: 36, // The length of each line
  width: 17, // The line thickness
  radius: 45, // The radius of the inner circle
  scale: 1.65, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  color: '#6a64ff', // CSS color or array of colors
  fadeColor: 'transparent', // CSS color or array of colors
  speed: 1.1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: 'spinner-line-shrink', // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  className: 'spinner', // The CSS class to assign to the spinner
  top: '50%', // Top position relative to parent
  left: '50%', // Left position relative to parent
  shadow: '0 0 1px transparent', // Box-shadow for the lines
  position: 'absolute' // Element positioning
};

const SPINNER_TARGET = document.querySelector('#spinner');
let spinner = new Spin.Spinner(SPINNER_OPTIONS);

const POSSIBLE_PAGE_STATES = { //a crappy enum
  INITIAL_LOAD: 0,
  SUBMITTING_MESSAGE: 1,
  SUBMITTING_FILE: 2,
}
const PAGE_STATE = POSSIBLE_PAGE_STATES.INITIAL_LOAD

function reporter(event, oldState, newState) {
    console.log("[" + oldState + "] => [" + newState + "] :: " + event);
}

function start_spinner() {
  spinner.spin(SPINNER_TARGET);
}

function stop_spinner() {
  spinner.stop();
}

function submit_message_transition () {
  start_spinner();
  return 'MESSAGE_SUBMITTING'
}

function submit_file_transition() {
  stop_spinner();
  return 'FILE_SUBMITTING';
}

function finalize_submit_transition () {
  stop_spinner();
  location.reload();
  return 'INITIAL_LOAD';
}

function abort_submission_transition () {
  //show some kind of error message and stop spinner.
  console.error("THERE WAS A PROBLEM!!", XHR_ERROR_MESSAGE);
  stop_spinner();
  return 'INITIAL_LOAD';
}


const state_machine = new Stately({
  'INITIAL_LOAD': {
    onEnter: reporter,
    submit_message: submit_message_transition
  },
  'MESSAGE_SUBMITTING': {
    onEnter: reporter,
    finalize_submit: finalize_submit_transition,
    abort_submit: abort_submission_transition,
    submit_file: submit_file_transition,
  },
  'FILE_SUBMITTING': {
    onEnter: reporter,
    finalize_submit: finalize_submit_transition,
    abort_submit: abort_submission_transition
  }
})






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
        state_machine.finalize_submit();
      }
      else{
        state_machine.abort_submit();
        alert('Could not upload file.');
      }
    }

  };

  xhr.addEventListener('error', (e) => {
    XHR_ERROR_MESSAGE = e;
    state_machine.abort_submit();
  });

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
        uploadFile(file, response.s3Data);
      }
      else{
        alert('Could not get signed URL.');
      }
    }
  };

  xhr.addEventListener('error', (e) => {
    XHR_ERROR_MESSAGE = e;
    state_machine.abort_submit();
  });

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


function setSubmitComplete() {

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

        const file = getFile();
        if (!file) {
          state_machine.finalize_submit();
          return;
        }

        state_machine.submit_file();
        getSignedRequestAndUploadFile(response.s3_object_key, file)

      } else {
        console.log("Something went wrong when trying to submit");
      }
    }
  };

  xhr.addEventListener('error', (e) => {
    XHR_ERROR_MESSAGE = e;
    state_machine.abort_submit();
  });

  state_machine.submit_message();
  xhr.send(formData);
}


// This is a thing I found here: https://tympanus.net/codrops/2015/09/15/styling-customizing-file-inputs-smart-way/
// It's for having the file select label (used instead of the browser styled input type="file" button)
// indicate when a file is selected
var inputs = document.querySelectorAll('#file-input');
Array.prototype.forEach.call( inputs, function( input )
{
  const label  = input.nextElementSibling;

  input.addEventListener( 'change', function( e )
  {
    var fileName = '';
    if( !this.files || this.files.length == 0 ) {
      label.innerHTML = 'Attach Media';
    } else {
      label.innerHTML = e.target.value.split('\\').pop();
    }
  });
});


/*
   Bind listeners when the page loads.
*/
(() => {
  document.querySelector('#file-input').onchange = setFormDataForFile;
  document.querySelector('#entry-submit-button').addEventListener('click', submitButtonEventListener);
})();
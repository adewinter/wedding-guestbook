let XHR_ERROR_MESSAGE = '';

const SPINNER_OPTIONS = {
  lines: 15, // The number of lines to draw
  length: 25, // The length of each line
  width: 13, // The line thickness
  radius: 15, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  color: '#6a64ff', // CSS color or array of colors
  fadeColor: 'transparent', // CSS color or array of colors
  speed: 1.1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: 'spinner-line-shrink', // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  className: 'spinner', // The CSS class to assign to the spinner
  top: '30px', // Top position relative to parent
  left: '50%', // Left position relative to parent
  shadow: '0 0 1px transparent', // Box-shadow for the lines
  position: 'relative' // Element positioning
};

const SPINNER_TARGET = document.querySelector('#spinner-container');
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
  document.querySelector('#paperclip-button-container').style.display = 'none';
}

function stop_spinner() {
  spinner.stop();
}

function show_progress() {
  const progressContainer = document.querySelector('#progress-bar');
  progressContainer.style.display = 'block';
}

function hide_progress() {
  const progressContainer = document.querySelector('#progress-bar');
  progressContainer.style.display = 'none';
}

function set_progress_value(percent) {
  const progressElement = document.querySelector('#progress-bar progress');
  progressElement.setAttribute('value', percent);
}

function submit_message_transition () {
  start_spinner();
  return 'MESSAGE_SUBMITTING'
}

function disable_submit_button() {
  document.querySelector('#entry-submit-button').setAttribute('disabled', true);
}

function enable_submit_button() {
  document.querySelector('#entry-submit-button').removeAttribute('disabled');
}

function submit_file_transition() {
  start_spinner();
  show_progress();
  disable_submit_button();

  return 'FILE_SUBMITTING';
}

function finalize_submit_transition () {
  stop_spinner();
  hide_progress();
  clear_form();
  window.location.reload();
  return 'INITIAL_LOAD';
}

function finalize_file_submit_transition () {
  stop_spinner();
  hide_progress();
  enable_submit_button();
  update_label_success();
  return 'INITIAL_LOAD';
}

function abort_submission_transition () {
  //show some kind of error message and stop spinner.
  console.error("THERE WAS A PROBLEM!!", XHR_ERROR_MESSAGE);
  stop_spinner();
  hide_progress();
  return 'INITIAL_LOAD';
}


function update_label_success() {
  document.querySelector('#attach-media-button').innerHTML = "<span>✔️</span>";
}


const state_machine = new Stately({
  'INITIAL_LOAD': {
    onEnter: reporter,
    submit_message: submit_message_transition,
    submit_file: submit_file_transition
  },
  'MESSAGE_SUBMITTING': {
    onEnter: reporter,
    finalize_submit: finalize_submit_transition,
    abort_submit: abort_submission_transition,
  },
  'FILE_SUBMITTING': {
    onEnter: reporter,
    abort_submit: abort_submission_transition,
    finalize_submit: finalize_file_submit_transition,
    trigger_stream_prep: 'STREAM_PREP_TRIGGERING'
  },
  'STREAM_PREP_TRIGGERING': {
    onEnter: reporter,
    finalize_submit: finalize_file_submit_transition,
    abort_submit: abort_submission_transition
  }
})

function triggerStreamingPrep(signedResponseData) {
  const presigned_url = signedResponseData.presigned_url;
  const s3_object_key = signedResponseData.s3Data.fields.key;
  const url = `/prep-for-streaming/`;
  const postData = new FormData();
  postData.append('presigned_url', presigned_url);
  postData.append('s3_object_key', s3_object_key);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.onreadystatechange = () => {
    if(xhr.readyState === 4){
      if(xhr.status === 200){
        const response = JSON.parse(xhr.responseText);
        const thumbnail_url = response.thumbnail;
        const cloudflare_uid = response.uid;
        document.querySelector('#cloudflare-uid').value = cloudflare_uid;
        document.querySelector('#thumbnail-url').value = thumbnail_url;

        state_machine.finalize_submit();
      }
    }
  }


  xhr.addEventListener('error', (e) => {
    XHR_ERROR_MESSAGE = e;
    state_machine.abort_submit();
  });

  xhr.send(postData);
}

function clear_form() {
  const formElements = document.querySelector('#entry-submit-form').children;
  for (let element of formElements) {
    element.value = '';
  }

  document.querySelector('#attach-media-button > span').innerHTML = 'Attach Media';
  document.querySelector('#file-input').value = '';
  document.querySelector('#paperclip-button-container').style.display = '';
}

function progressHandler(event) {
  const msg = "Uploaded " + event.loaded + " bytes of " + event.total;
  const percent = Math.round((event.loaded / event.total) * 100);
  set_progress_value(percent);
  console.log(msg, percent);
}


/*
  Function to carry out the actual POST request to S3 using the signed request from the Python app.
*/
function uploadFile(file, signedResponseData){
  const s3Data = signedResponseData.s3Data;
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
        if (file.type.indexOf('video/') !== -1) {
          state_machine.trigger_stream_prep();
          triggerStreamingPrep(signedResponseData);
        } else {
          state_machine.finalize_submit();
        }
      }
      else{
        state_machine.abort_submit();
        alert('Could not upload file.');
      }
    }

  };

  xhr.upload.addEventListener("progress", progressHandler);

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
        uploadFile(file, response);
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

function fileInputStateChanged(e) {
  console.log('File input state has changed!', e);
  const file = getFile();

  if (!file) {
    return console.log('No file selected.');
  }

  document.getElementById('filetype').value = file.type;
  document.getElementById('filename').value = file.name;

  const xhr = new XMLHttpRequest();
  const get_s3_object_key_url = '/generate_s3_object_key/';
  const postData = new FormData();

  postData.append('filename', file.name);
  postData.append('filetype', file.type);

  xhr.open('POST', get_s3_object_key_url);

  xhr.addEventListener('error', (e) => {
    XHR_ERROR_MESSAGE = e;
    state_machine.abort_submit();
  });

  xhr.onreadystatechange = () => {
    if(xhr.readyState === 4){
      if(xhr.status === 200){
        const response = JSON.parse(xhr.responseText);
        const s3_object_key = response.s3_object_key;

        document.querySelector('#s3-object-key').value = s3_object_key;

        getSignedRequestAndUploadFile(s3_object_key, file);
      }
      else{
        alert('Could not get a s3 object key for file: ' + file.name);
      }
    }
  };

  state_machine.submit_file();
  xhr.send(postData);
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
        state_machine.finalize_submit();
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
  document.querySelector('#paperclip-button-container').addEventListener('click', () => { document.querySelector('#attach-media-button').click() });
  document.querySelector('#file-input').onchange = fileInputStateChanged;
  document.querySelector('#entry-submit-button').addEventListener('click', submitButtonEventListener);
})();
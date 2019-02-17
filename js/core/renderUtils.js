function render(){

  if (!(mode == 1 && isPaused)){
    requestID = requestAnimationFrame(render);
  }else{
    return;
  }

  GLOBAL_CAMERA_POSITION_UNIFORM.value.copy(camera.position);
  GLOBAL_CAMERA_QUATERNION_UNIFORM.value.copy(camera.quaternion);
  GLOBAL_ADDEDTEXT_VIEWPORT_UNIFORM.value.set(0, 0, window.innerWidth * screenResolution, window.innerHeight * screenResolution);

  if (!(mode == 1 && defaultCameraControlsDisabled)){
    processKeyboardBuffer();
  }
  handleSkybox();
  if (!stopAreaConfigurationsHandler){
    areaConfigurationsHandler.handle();
  }

  if (physicsDebugMode){
    debugRenderer.update();
  }

  if (mode == 1){
    if (!isPhysicsWorkerEnabled()){
      physicsWorld.step(physicsStepAmount);
      updateDynamicObjects();
      updateTrackingObjects();
    }
    processCameraRotationBuffer();
    runScripts();
    updateRaycaster();
    updateParticleSystems();
    updateObjectTrails();
    updateCrosshair();
  }else{
    cameraOperationsDone = false;
  }

  renderScene();
  updateAddedTexts();
  if (mode == 1){
    previewSceneRendered = true;
  }
  frameCounter ++;
}


function renderScene(){
  if (mode == 0){
    renderer.render(scene, camera);
  }else{
    if (bloomOn){
      composer.render(0.1);
    }else{
      renderer.render(scene, camera);
    }
  }
}

function updateAddedTexts(){
  if (mode == 0){
    for (var addedTextName in addedTexts){
      var addedText = addedTexts[addedTextName];
      if (addedText.needsUpdate() && !addedText.is2D){
        addedText.handleBoundingBox();
        rayCaster.updateObject(addedText);
      }
    }
  }else{
    for (var addedTextName in clickableAddedTexts){
      var addedText = addedTexts[addedTextName];
      if (addedText.needsUpdate() && !addedText.is2D){
        addedText.handleBoundingBox();
        rayCaster.updateObject(addedText);
      }
    }
  }
}

function updateCrosshair(){
  if (selectedCrosshair && (selectedCrosshair.angularSpeed != 0 || selectedCrosshair.expand || selectedCrosshair.shrink)){
    selectedCrosshair.update();
  }
}

function updateRaycaster(){
  rayCaster.binHandler.update();
}

function updateParticleSystems(){
  for (var particleSystemName in particleSystems){
    var particleSystem = particleSystems[particleSystemName];
    if (particleSystem && !particleSystem.destroyed){
      particleSystem.update();
    }
  }
  for (var mergedParticleSystemName in mergedParticleSystems){
    mergedParticleSystems[mergedParticleSystemName].update();
  }
}

function updateObjectTrails(){
  for (var objectName in activeObjectTrails){
    var objectTrail = activeObjectTrails[objectName];
    if (objectTrail && !objectTrail.destroyed){
      objectTrail.update();
    }
  }
}

function runScripts(){
  for (var scriptName in scriptsToRun){
    scripts[scriptName].execute();
  }
}

function updateTrackingObjects(){
  for (var objName in trackingObjects){
    var obj = addedObjects[objName];
    var isObjectGroup = false;
    if (!obj){
      obj = objectGroups[objName];
      isObjectGroup = true;
    }
    obj.mesh.position.set(
      obj.mesh.position.x + obj.trackedObject.dx,
      obj.mesh.position.y + obj.trackedObject.dy,
      obj.mesh.position.z + obj.trackedObject.dz
    );
    obj.physicsBody.position.copy(obj.mesh.position);
    if (isObjectGroup){
      obj.graphicsGroup.position.copy(obj.mesh.position);
      obj.graphicsGroup.quaternion.copy(obj.mesh.quaternion);
    }
    if (obj.mesh.visible){
      rayCaster.updateObject(obj);
    }
  }
}

function updateDynamicObjects(){
  for (var objectName in dynamicObjects){
    var object = addedObjects[objectName];
    var physicsBody = object.physicsBody;
    var axis = object.metaData.axis;
    var gridSystemAxis = object.metaData.gridSystemAxis;
    var type = object.type;
    if (object.isTracked){
      object.dx = physicsBody.position.x - object.oldPX;
      object.dy = physicsBody.position.y - object.oldPY;
      object.dz = physicsBody.position.z - object.oldPZ;
      object.oldPX = physicsBody.position.x;
      object.oldPY = physicsBody.position.y;
      object.oldPZ = physicsBody.position.z;
    }
    object.mesh.position.copy(physicsBody.position);
    setTHREEQuaternionFromCANNON(object.mesh, physicsBody, axis, type, gridSystemAxis);
  }
  for (var grouppedObjectName in dynamicObjectGroups){
    var grouppedObject = objectGroups[grouppedObjectName];
    var physicsBody = grouppedObject.physicsBody;
    if (grouppedObject.isTracked){
      grouppedObject.dx = physicsBody.position.x - grouppedObject.oldPX;
      grouppedObject.dy = physicsBody.position.y - grouppedObject.oldPY;
      grouppedObject.dz = physicsBody.position.z - grouppedObject.oldPZ;
      grouppedObject.oldPX = physicsBody.position.x;
      grouppedObject.oldPY = physicsBody.position.y;
      grouppedObject.oldPZ = physicsBody.position.z;
    }
    grouppedObject.mesh.position.copy(physicsBody.position);
    grouppedObject.mesh.quaternion.copy(physicsBody.quaternion);
  }
}

function setTHREEQuaternionFromCANNON(mesh, physicsBody, axis, type, gridSystemAxis){
  mesh.quaternion.copy(physicsBody.quaternion);
  if (type == "ramp" || type == "surface"){
    if (gridSystemAxis == "XZ" || gridSystemAxis == "XY" || gridSystemAxis == "YZ"){
      if (!(type == "surface" && (gridSystemAxis == "XY" || gridSystemAxis == "YZ"))){
        mesh.rotateX(Math.PI / 2);
      }else{
        if (type == "surface" && gridSystemAxis == "YZ"){
          mesh.rotateY(Math.PI / 2);
        }
      }
    }
  }else if (type == "cylinder"){
    if (gridSystemAxis == "YZ"){
      mesh.rotateZ(Math.PI / 2);
    }else if (gridSystemAxis == "XY"){
      mesh.rotateX(Math.PI / 2);
    }
  }
}

function calculateFps (){
  if (mode == 1 && isPaused){
    return;
  }
  if (maxInactiveTime > 0 && userInactivityCallbackFunction){
    if (inactiveCounter >= maxInactiveTime){
      userInactivityCallbackFunction();
      userInactivityCallbackFunction = 0;
      maxInactiveTime = 0;
      inactiveCounter = 0;
    }
    inactiveCounter ++;
  }
  if (!isScreenVisible){
    return;
  }
  if (LOG_FRAME_DROP_ON){
    if (frameCounter < 60){
      FRAME_DROP_COUNT += 60 - frameCounter;
    }
    LOG_FRAME_DROP_CTR ++;
    if (LOG_FRAME_DROP_CTR == 60){
      LOG_FRAME_DROP_ON = false;
      console.log("[*] Frame-drops: "+FRAME_DROP_COUNT);
    }
  }
  fps = frameCounter;
  frameCounter = 0;
  if (mode == 1 && fpsDropCallbackFunction && fps < 60){
    fpsDropCallbackFunction(60 - fps);
  }
  if (mode == 1 && performanceDropCallbackFunction){
    if (fps < performanceDropMinFPS){
      performanceDropCounter ++;
      if (performanceDropCounter == performanceDropSeconds){
        performanceDropCallbackFunction();
        performanceDropCounter = 0;
        performanceDropMinFPS = 0;
        performanceDropSeconds = 0;
        performanceDropCallbackFunction = 0;
      }
    }else{
      performanceDropCounter = 0;
    }
  }
  if (!isDeployment && !scriptEditorShowing && (fps != lastFPS)){
    if (mode == 0){
      cliDivheader.innerText = "ROYGBIV 3D Engine - CLI (Design mode) - "+fps+" FPS";
    }else if (mode == 1){
      cliDivheader.innerText = "ROYGBIV 3D Engine - CLI (Preview mode) - "+fps+" FPS";
    }
  }
  lastFPS = fps;
}

function handleSkybox(){
  if (skyboxMesh){
    skyboxMesh.position.copy(camera.position);
  }
}

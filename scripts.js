(function(){
  var screen = $("#bft_screen");
  var list = $("#bft_list");
  var HONEST_COLOR = "#28a745";
  var MALICE_COLOR = "#dc3545";
  var REJECTED_COLOR = "#ffc107";
  var UNKNOWN_COLOR = "#888888";

  var remainingToLoad = 0;
  function loadImage(uri){
      remainingToLoad ++;
      var image = new Image();
      image.onload = function(){
          remainingToLoad --;
          if(remainingToLoad == 0){
              exec();
          }
      };
      image.src = uri;
      return image;
  }
  var honest = loadImage("pbft/honest.png");
  var malice = loadImage("pbft/malice.png");

  var timer = null;
  const baseFPS = 60.0; // Constant FPS for all speeds

  function exec(){
      if(timer != null){
          window.clearTimeout(timer);
          timer = null;
      }

      var g = screen.get(0).getContext("2d");
      var n =  parseInt($("#bft_n").val());
      var m = parseInt($("#bft_m").val());
      var f = Math.floor((n - 1) / 3.0);
      var maliciousOrigin = $("#bft_faulty_proposer").prop("checked");
      var falsehoodMessage = $("#bft_allow_tampering").prop("checked");
      var w = Math.min(screen.width(), screen.height());
      var iw = 40;
      var th = 12;
      var phase = 3;
      var phaseInterval = 2.2;
      var phaseStep = phaseInterval * baseFPS;

      // Get the speed multiplier from the slider (value between 1 and 60)
      var speedMultiplier = parseFloat($("#animation_speed").val());
      var interval = Math.floor(1000 / (baseFPS * (speedMultiplier / 15))); // Adjust interval based on speed

      function isHonest(i){
          if(m == 0)  return true;
          if(maliciousOrigin){
              return i != 0 && i <= n - m;
          }
          return i == 0 || i < n - m;
      }

      function text(value){
          switch(value){
              case null:  return "ARBITRARY";
              case 0:     return "TRUTH";
              case 1:     return "FALSEHOOD";
              default:    return "Rejected";
          }
      }

      function order(value){
          var label = text(value);
          var color = null;
          switch(value){
              case null:  color = "danger"; break;
              case 0:     color = "success";  break;
              case 1:     color = "success";  break;
              default:    color = "warning"; break;
          }
          return "<span class='text-" + color + "'>" + label + "</span>";
      }

      function buildPrepareMessage(msg){
          return (msg.src+1) + (msg.dst != null? ("→" + (msg.dst+1)):"") + ":" + (msg.tampered? "😈": "😇") + order(msg.value);
      }

      function drawMessage(msg, x, y){
          _drawMessage(x, y, [{
              text: (msg.src+1) + (msg.dst != null? ("→" + (msg.dst+1)): "") + ":" + (msg.tampered? "😈": "😇"),
              color: "#000000"
          }, {
              text: text(msg.value),
              color: msg.value == null? MALICE_COLOR: msg.value < 0? REJECTED_COLOR: (msg.value == 0? HONEST_COLOR: MALICE_COLOR)
          }]);
      }

      function _drawMessage(x, y, msgs){
          var th = 8;
          g.font = "normal 400 " + th + "px sans-serif";
          var tws = msgs.map(function(m){ return g.measureText(m.text).width; });
          var maxWidth = Math.max.apply(null, tws);
          g.fillStyle = "#FFFFFF";
          g.fillRect(x - maxWidth / 2, y - th, maxWidth, th * msgs.length);
          g.strokeStyle = "#888888";
          g.beginPath();
          g.strokeRect(x - maxWidth / 2 - 1, y - th - 1, maxWidth + 2, th * msgs.length + 2);
          g.stroke();
          for(var i=0; i<msgs.length; i++){
              g.fillStyle = msgs[i].color;
              g.fillText(msgs[i].text, x - tws[i] / 2, y + th * i);
          }
      }

      // Creating scenarios
      var prePrepare = [];
      for(var i=0; i<n; i++){
          prePrepare.push({
              src: 0, dst: i == 0? null: i, value: isHonest(0)? 0: Math.random() < 0.5? 0: 1, tampered: !isHonest(0)
          });
      }

      var prepare = [];
      for(var dst=0; dst<n; dst++){
          var msgs = [];
          for(var src=0; src<n; src++){
              if(src != dst && prePrepare[src].dst != null){
                  var value = isHonest(src)? prePrepare[src].value: falsehoodMessage? Math.random() < 0.5? 0: 1: null;
                  var tampered = value != prePrepare[src].value;
                  msgs.push({
                      src: prePrepare[src].src, dst: prePrepare[src].dst, value: value, tampered: tampered
                  });
              }
          }
          prepare.push(msgs);
      }

      function acceptedValueInPrepare(i){
          if(! isHonest(i)){
              return null;
          }
          var valid = prepare[i]
              .filter(function(x){ return x.dst != i && x.src != x.dst; })
              .map(function(x){ return x.value; })
              .filter(function(x){ return x == prePrepare[i].value; })
              .length;
          if((valid + 1) / (prepare[i].length + 1) >= 2 / 3){
              return prePrepare[i].value;
          } else {
              return -1;
          }
      }

      // commit
      var commit = [];
      for(var dst=0; dst<n; dst++){
          var msgs = [];
          for(var src=0; src<n; src++){
              if(src != dst){
                  var value = (isHonest(src) || !falsehoodMessage)? acceptedValueInPrepare(src): (Math.random() < 0.5? 0: 1);
                  var tampered = !isHonest(src);
                  msgs.push({
                      src: src, dst: null, value: value, tampered: tampered
                  });
              }
          }
          commit.push(msgs);
      }

      function acceptedValueInCommit(i){
          if(! isHonest(i)){
              return null;
          }
          var values = commit[i].map(function(x){ return x.value; });
          values.push(acceptedValueInPrepare(i));
          values = values.filter(function(x){ return x != null && x >= 0; });
          var zero = values.filter(function(x){ return x == 0; }).length;
          var one = values.filter(function(x){ return x == 1; }).length;
          if(zero / n >= 2 / 3){
              return 0;
          }
          if(one / n >= 2 / 3){
              return 1;
          }
          return -1;
      }

      // Agree on whether all commit results of the normal process are the same.
      (function(){
          var truth = 0;
          var falsehood = 0;
          var rejected = 0;
          for(var i=0; i<n; i++){
              if(isHonest(i)){
                  switch(acceptedValueInCommit(i)){
                      case 0: truth ++; break;
                      case 1: falsehood ++; break;
                      case -1: rejected ++; break;
                      default: console.log("unexpected committed state: ", acceptedValueInCommit(i)); break;
                  }
              }
          }
          if(truth + falsehood + rejected == 0){
              $("#bft_conclusion").attr("class", "badge badge-secondary").text("No non-faulty process");
          } else if(truth + falsehood == 0){
              $("#bft_conclusion").attr("class", "badge badge-warning").html("Agreed to <i>reject the proposal</i>");
          } else if(rejected == 0 && (truth > 0 && falsehood == 0) || (truth == 0 && falsehood > 0)){
              $("#bft_conclusion").attr("class", "badge badge-success").html("Agreed to <b>" + text(0) + "</b>");
          } else {
              $("#bft_conclusion").attr("class", "badge badge-danger").html("Contradiction, consensus failed");
          }
      })();

      // Update table listings
      list.empty();
      for(var i=0; i<n; i++){
          var prePrepareLabel = buildPrepareMessage(prePrepare[i]);
          if(i != 0){
              prePrepareLabel =  "<span class='bft_phase_preprepare' style='opacity:.2;'>" + prePrepareLabel + "</span>";
          }
          var prepareLabel = "<span class='bft_phase_prepare' style='line-height:100%;opacity:.2;'>" +
              prepare[i].map(function(x){ return buildPrepareMessage(x); })
                  .join("<br/>") + "<br/>" + ((function(){
                      var value = acceptedValueInPrepare(i);
                      var color = value==null? "danger": value>=0? "success": "warning";
                      var label = value==null? "<i>Arbitrary</i>": value>=0? text(value): "<i>Rejected</i>";
                      return "<span class='badge badge-" + color + " bft_phase_prepare' style='opacity:.5;'>" + label + "</span>";
                  })()) + "</span>";
          var commitLabel = "<span class='bft_phase_commit' style='opacity:.2;'>" +
              commit[i].map(function(x){ return buildPrepareMessage(x); }).join("<br/>") +
              "<br/>" + ((function(){
                  var value = acceptedValueInCommit(i);
                  var color = value==null? "danger": value>=0? "success": "warning";
                  var label = value==null? "<i>Arbitrary</i>": value>=0? text(value): "<i>Rejected</i>";
                  return "<span class='badge badge-" + color + " bft_phase_commit' style='opacity:.5;'>" + label + "</span>";
              })()) + "</span>";
          list.append($("<tr/>")
              .append($("<td/>").html((i+1) + ".<img src='" + (isHonest(i)? honest.src: malice.src) + "' height='20'/>"
                  + "<br/><b>" + (i==0? "proposer": "follower") + "</b>"))
              .append($("<td/>").html(prePrepareLabel))
              .append($("<td/>").html(prepareLabel))
              .append($("<td/>").html(commitLabel))
          );
      }

      // Calculate the general's position
      var xy = [];
      (function(){
          var r = (w - iw - th) / 2.0;
          for(var i=0; i<n; i++){
              var theta = Math.PI - (2 * Math.PI / n) * i;
              xy.push({
                  x: w / 2 + r * Math.sin(theta),
                  y: w / 2 - (th / 2) + r * Math.cos(theta)
              });
          }
      })();

      function drawBackground(){

          // Deploying Generals
          g.clearRect(0, 0, w-1, w-1);

          g.strokeStyle = "#CCCCCC";
          g.beginPath();
          g.rect(0, 0, w-1, w-1);
          g.stroke();

          // Lines connecting nodes
          g.strokeStyle = "#EEEEEE";
          g.beginPath();
          for(var i=0; i<xy.length; i++){
              for(var j=0; j<xy.length; j++){
                  if(i != j){
                      g.moveTo(xy[i].x, xy[i].y);
                      g.lineTo(xy[j].x, xy[j].y);
                  }
              }
          }
          g.stroke();
      }

      function drawForeground(phase){
          // Deploying Generals
          for(var i=0; i<xy.length; i++){
              var img = isHonest(i)? honest: malice;
              g.drawImage(img, xy[i].x - iw / 2, xy[i].y - iw / 2, iw, iw);
              var tw = g.measureText(i + 1).width;
              g.font = "normal 700 " + th + "px sans-serif";
              g.fillStyle = "#000000";
              g.fillText(i + 1, xy[i].x - tw / 2, xy[i].y + iw / 2 + 12);

              function _draw(value){
                  var t = text(value);
                  var thc = 8;
                  g.font = "normal 400 " + thc + "px sans-serif";
                  var tw = g.measureText(t).width;
                  var tx = xy[i].x - tw / 2;
                  var ty = xy[i].y + iw / 2 - 2;
                  g.fillStyle = value == null? MALICE_COLOR: value>=0? HONEST_COLOR: REJECTED_COLOR;
                  g.fillRect(tx - 2, ty - thc - 1, tw + 4, thc + 2);
                  g.fillStyle = "#FFFFFF";
                  g.fillText(t, tx, ty - 1);
              }
              if((phase == 0 && i == 0) || phase == 1){
                  _draw(isHonest(i)? prePrepare[i].value: null);
              } else if(phase == 2){
                  _draw(acceptedValueInPrepare(i));
              } else if(phase == 3){
                  _draw(acceptedValueInCommit(i));
              }
          }
      }

      function drawPrePreparePhase(d){
          for(var i=1; i<n; i++){
              var x = xy[0].x + d * (xy[i].x - xy[0].x);
              var y = xy[0].y + d * (xy[i].y - xy[0].y);
              drawMessage(prePrepare[i], x, y);
          }
      }

      function drawPreparePhase(d){
          for(var i=1; i<n; i++){
              for(var j=0; j<n; j++){
                  var msg = prepare[j].find(function(x){ return x.dst == i; });
                  if(msg != null){
                      var x = xy[i].x + d * (xy[j].x - xy[i].x);
                      var y = xy[i].y + d * (xy[j].y - xy[i].y);
                      drawMessage(msg, x, y);
                  }
              }
          }
      }

      function drawCommitPhase(d){
          for(var i=0; i<n; i++){
              for(var j=0; j<n; j++){
                  var msg = commit[j].find(function(x){ return x.src == i; });
                  if(msg != null){
                      var x = xy[i].x + d * (xy[j].x - xy[i].x);
                      var y = xy[i].y + d * (xy[j].y - xy[i].y);
                      drawMessage(msg, x, y);
                  }
              }
          }
      }

      function animation(step){
          drawBackground();
          if(step <= phaseStep){
              drawPrePreparePhase(step / phaseStep);
          } else if(step >= phaseStep && step < 2 * phaseStep){
              drawPreparePhase((step - phaseStep) / phaseStep);
          } else  if(step >= 2 * phaseStep && step < 3 * phaseStep){
              drawCommitPhase((step - 2 * phaseStep) / phaseStep);
          }
          if(step == 0){
          }
          if(step <= phaseStep && (step + 1) >= phaseStep){
              $(".bft_phase_preprepare").animate({opacity: 1.0}, "fast");
          }
          if(step <= 2 * phaseStep && (step + 1) >= 2 * phaseStep){
              $(".bft_phase_prepare").animate({opacity: 1.0}, "fast");
          }
          drawForeground(Math.floor(step / phaseStep));
          if(step < phase * phaseStep){
              timer = window.setTimeout(function(){
                  animation(step + 1);
              }, interval);
          } else {
              $(".bft_phase_commit").animate({opacity: 1.0}, "fast");
              timer = null;
          }
      }

      $("#bft_description").height($("#bft_control").height());

      animation(0);

      console.log(n, m, f, screen.width(), screen.height(), xy, maliciousOrigin);
      return false;
  }

  $("#bft_exec").click(exec);

  // Re-execute the animation when the speed slider value changes
  $("#animation_speed").on("input", exec);

  exec();
})();

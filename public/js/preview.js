var preview_loop;
var preview_physical_ratio_value=null;
var preview_physical_ratio_request=null;
var preview_physical_ratio_retry_after=0;

function preview_physical_ratio(config){
	if (!config || typeof config!=='object') return null;
	var width=Number(config.ProjectorWidth), height=Number(config.ProjectorHeight);
	var x=Number(config.XYRes), y=Number(config.YRes);
	// YRes is an optional override of the shared X/Y pixel size.
	if (config.YRes==null || config.YRes==='' || y===0) y=x;
	if (![width,height,x,y].every(function(value){return isFinite(value) && value>0;})) return null;
	var ratio=(width*x)/(height*y);
	return isFinite(ratio) && ratio>0 ? ratio : null;
}

function preview_fit_dimensions(maxWidth,maxHeight,ratio){
	if (![maxWidth,maxHeight,ratio].every(function(value){return isFinite(value) && value>0;})) return null;
	var width=Math.min(maxWidth,maxHeight*ratio);
	return {width:width,height:width/ratio};
}

function preview_apply_physical_size(image,maxWidth,maxHeight,ratio){
	var size=preview_fit_dimensions(maxWidth,maxHeight,ratio);
	if (!image || !size) return null;
	// Layer PNG dimensions can be packed or reduced. Their natural aspect
	// does not represent the physical LCD, including rectangular pixel pitch.
	image.style.aspectRatio=String(ratio);
	image.style.objectFit='fill';
	image.style.maxWidth='none';
	image.style.maxHeight='none';
	image.style.width=size.width+'px';
	image.style.height=size.height+'px';
	return size;
}

function preview_load_physical_ratio(callback){
	var request=preview_physical_ratio_request;
	if (!request){
		if (Date.now()<preview_physical_ratio_retry_after) return;
		request=$.getJSON('/json/db/machine.json');
		preview_physical_ratio_request=request;
		request.done(function(config){
			preview_physical_ratio_value=preview_physical_ratio(config);
			if (!preview_physical_ratio_value){
				preview_physical_ratio_request=null;
				preview_physical_ratio_retry_after=Date.now()+30000;
			}
		}).fail(function(){
			preview_physical_ratio_request=null;
			preview_physical_ratio_retry_after=Date.now()+30000;
		});
	}
	request.done(function(){callback(preview_physical_ratio_value);});
}

function preview_status_image_resize(){
	var frame=document.getElementById('image_wrapper');
	if (!frame) return;
	var box=frame.querySelector('.image_enlarge');
	var image=frame.querySelector('img.two');
	if (!box || !image) return;
	if (!preview_physical_ratio_value){
		preview_load_physical_ratio(function(ratio){if (ratio) preview_status_image_resize();});
		return;
	}
	preview_apply_physical_size(image,box.clientWidth,box.clientHeight,preview_physical_ratio_value);
}

function preview_status_image_init(){
	var frame=document.getElementById('image_wrapper');
	if (!frame) return;
	preview_load_physical_ratio(preview_status_image_resize);
	if (window.ResizeObserver){
		new ResizeObserver(preview_status_image_resize).observe(frame);
	} else {
		$(window).on('resize.statusPreviewPhysicalRatio',preview_status_image_resize);
	}
}

function preview_layer_unavailable(){
	if (window.toastr) toastr.warning('Display Layer is unavailable while printing or printer status cannot be confirmed.');
}
function preview_init(){
	preview_status_image_init();
	var previewImage = $('#preview img');
	if (previewImage.length==0) return;
	preview_load_physical_ratio(function(ratio){
		if (ratio){
			function sizePreviewImage(){
				var preview = $('#preview');
				var panel = preview.closest('.c3d-preview-canvas');
				var size=preview_apply_physical_size(previewImage[0],preview.innerWidth(),panel.height(),ratio);
				if (size) preview[0].style.height=size.height+'px';
			}
			sizePreviewImage();
			if (window.ResizeObserver){
				new ResizeObserver(sizePreviewImage).observe($('#preview')[0]);
			} else {
				$(window).on('resize.previewPhysicalRatio', sizePreviewImage);
			}
		}
	});
	$("body").delegate("#preview img","click",function(e){
		window.open("/plate/preview/image/"+layer_url(),'Image');
	}).delegate("#preview_layer","click",function(e){
		e.preventDefault();
		if ($('body').hasClass('c3d-printing')) { preview_layer_unavailable(); return; }
		var btn = this;
		// The print state can change after page load. Confirm it immediately
		// before any projector request, including the blank/close action.
		$.ajax({url: '/status', dataType: 'json', cache: false}).done(function(status){
			if (!status || status.Printing) { preview_layer_unavailable(); return; }
			var t=$("#preview_range");
			if (t.data("clicked")){
				t.data("clicked",false);
				$(btn).find(".c3d-btn-label").text("Preview");
				$.get("/projector/blank");
			} else {
				confirm_action($(btn), function(){
					// Recheck after the confirmation dialog as printing may have started.
					$.ajax({url: '/status', dataType: 'json', cache: false}).done(function(latestStatus){
						if (!latestStatus || latestStatus.Printing) { preview_layer_unavailable(); return; }
						$.get("/projector/display/"+"plates***"+t.data("plate")+"***"+t.val()+".png");
						t.data("clicked",true);
						$(btn).find(".c3d-btn-label").text("Close");
					}).fail(preview_layer_unavailable);
				});
			}
		}).fail(preview_layer_unavailable);
	}).delegate("#preview_play", "click", function () {
		$("#preview_play").addClass("hide");
		$("#preview_stop").removeClass("hide");
		preview_loop = setInterval(function () {
			t = $("#preview_range");
			if (parseInt(t.val()) + 1 > parseInt(t.attr("max"))){
				$("#preview_stop").trigger("click");
			}
			t.val(parseInt(t.val()) + 1);
			t.trigger("change");
		}, $(".play-delay").val() * 1000);
	}).delegate("#preview_stop", "click", function () {
		$("#preview_play").removeClass("hide");
		$("#preview_stop").addClass("hide");
		clearTimeout(preview_loop);
	}).delegate("#preview_previous","click",function(){
		$("#preview_range").val($("#preview_range").val()-1);
		$("#preview_range").trigger("change");
	}).delegate("#preview_next","click",function(){
		$("#preview_range").val(parseInt($("#preview_range").val())+1);
		$("#preview_range").trigger("change");
	}).delegate(".overhang","click",function(e){
		e.preventDefault();
		$("#preview_range").val($(this).text());
		$("#preview_range").trigger("change");
	}).delegate("#toggle_details","click",function(){
		if ($(this).data("display")){
			$(this).data("display",false);
			$("#details").addClass("hide");
			$("#threed").addClass("hide");
			$("#preview").parent().removeClass("col-md-4").addClass("col-md-12");
			$(".mc_overlay").remove();
			return;
		}
		$(this).data("display",true);
		$("#preview").parent().removeClass("col-md-4").addClass("col-md-4");
		$("#details").removeClass("hide");
		$("#threed").removeClass("hide");
		mc_guide();
		preview_update();
	}).delegate("#toggle_compare","click",function(){
		if ($(this).hasClass("btn-success")){
			$(this).removeClass("btn-success");
		} else {
			$(this).addClass("btn-success");
		}
		preview_update();
	}).delegate("#preview_range","change keypress",function(){
		preview_update();
	});	
	preview_update();	
}

var compareTimer;
function preview_url(){
	var current_layer = $('#preview_range').val();
	return '/plate/preview/'+$('#preview_range').data("plate")+'/'+current_layer;
}

function layer_url(){
	var current_layer = $('#preview_range').val();
	var d = new Date();
	var addon = '?' + d.getTime();
	return $('#preview img').data('path') + current_layer + '.png' + addon;
}

// info.json / layer data carry raw floats: 4622.943003065198 is not readable,
// and the long string used to widen its stat tile past the others
function format_metric(v){
	if (v === null || v === undefined) return v;
	var text = String(v);
	if (text.trim() === "") return v;
	var n = parseFloat(text);
	if (isNaN(n) || !/^\s*-?[0-9.]+\s*$/.test(text)) return v;
	if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
	return n.toFixed(Math.abs(n) >= 1000 ? 2 : 3);
}

function preview_update(){
	var t = $('#preview_range');
	var current_layer = t.val();
	clearTimeout(compareTimer);
	compareTimer = setTimeout(function(){ 
		compare($('#preview img'),$('#preview img').data('path'),current_layer);
	}, 100);
	
	$('#current_layer').html(current_layer);
	$('#preview img').attr('src', layer_url());
	if (!$("#toggle_details").data("display")) return;
	if ($('#threed img').length==0) $("#threed").html('<img src="'+preview_url()+'" class="two">');	
	else $('#threed img').attr("src",preview_url());
	$.getJSON($('#preview img').data('path')+"info.json").done(function(data) {
		d=data[current_layer-1];
		$.each(d,function(k,v){
			$("#"+k).html(format_metric(v));
		});
	});
	$.getJSON("/layer/preview/"+t.data("plate")+"/"+current_layer).done(function(data) {
		$.each(data,function(k,v){
			// gcode arrives with real newlines in some fields and with a literal
			// "\n" escape in others
			$("#"+k).html(format_metric(v).replace(/\\n/g, "<br>").replace(/\n/g, "<br>"));
		});
	});
	if (t.data("dynthickness")===null){
		return;
	}
	var thickness = t.data("dynthickness")[current_layer-1]-t.data("dynthickness")[current_layer-2];
	if (isNaN(thickness)) thickness=t.data("dynthickness")[current_layer-1];
	$("#LayerThickness").html(Math.round(thickness*1000)/1000);
}

function mc_guide(){
	var t = $('#preview_range');
	var mc = t.data("mc");
	var cc = t.data("cc");
	if  (mc.Count == 0 || cc.length<2){
		return;
	}
	var pw = t.data("w") / $("#preview").innerWidth();
	var ph = t.data("h") / $("#preview").innerHeight();
	var cure = 0;
	for (i = 0; i < mc.Count; i++){
		cure += cc[i];
		$("#preview").append('<div class="mc_overlay" style="left:'+(mc.X[i]/pw)+'px;top:'+(mc.Y[i]/ph)+'px;">'+cure+'s</div>');
	}
}
// function to retrieve an image
function loadImage(url) {
	return new Promise((fulfill, reject) => {
	  let imageObj = new Image();
	  imageObj.onload = () => fulfill(imageObj);
	  imageObj.src = url;
	});
}

function compare(selector,plate,current_layer){
	if (current_layer<2 || !$("#toggle_compare").hasClass("btn-success")) return;
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	context.canvas.width = selector.innerWidth();
	context.canvas.height = selector.innerHeight();
	if (context.canvas.width==0 || context.canvas.height==0) return;
	var d = new Date();
	var addon = '?' + d.getTime();
	Promise.all([		
		loadImage(plate+current_layer+".png"+addon),
		loadImage(plate+(current_layer-1)+".png"+addon),
	  ])
	  .then((images) => {
		context.drawImage(images[0], 0, 0, context.canvas.width, context.canvas.height);
		var c = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
		context.drawImage(images[1], 0, 0, context.canvas.width, context.canvas.height);
		var p = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
	
		for (i = 0; i < c.data.length; i+=4){
			if (c.data[i]>0&&p.data[i]==0){
				c.data[i+1] = 80;
				c.data[i+2] = 80;
			}
		}
		var img = imagedata_to_image(selector,c);
	  })
	  .catch( (e) => { if (window.toastr) toastr.error(String(e)); else console.error(e); } );
}

function imagedata_to_image(selector,imagedata) {
	var canvas = document.createElement('canvas');
	var ctx = canvas.getContext('2d');
	canvas.width = imagedata.width;
	canvas.height = imagedata.height;
	ctx.putImageData(imagedata, 0, 0);

	var image = new Image();
	selector.attr("src",canvas.toDataURL());
	return image;
}

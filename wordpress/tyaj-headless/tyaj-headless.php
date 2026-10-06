<?php
/**
 * Plugin Name: ThereYouAreJesus Site Connector
 * Description: Connects WordPress to the new ThereYouAreJesus.com site: Site Settings, category images, a Messages inbox for Share Your Thoughts, and automatic site rebuilds when John publishes.
 * Version: 1.3.0
 * Author: ThereYouAreJesus
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) { exit; }

const TYAJ_OPT = 'tyaj_settings';

/* ---------------------------------------------------------------
 * Settings helpers
 * ------------------------------------------------------------- */

function tyaj_defaults() {
	return array(
		'hero_title'   => '',
		'hero_text'    => '',
		'logo_id'      => 0,
		'notice_title' => '',
		'notice_text'  => '',
		'notice_date'  => '',
		'notice_link'  => '',
		'spirits'      => array_fill(0, 7, array('name' => '', 'verse' => '', 'ref' => '', 'meaning' => '')),
		'stations'     => '',
		'public_url'   => '',
		'deploy_hook'  => '',
		'notify_email' => get_option('admin_email'),
		'partnerships_email' => 'partnerships@thereyouarejesus.com',
		'press_email' => 'press@thereyouarejesus.com',
		'licensing_email' => 'licensing@thereyouarejesus.com',
		'store_email' => '',
	);
}

function tyaj_get() {
	$saved = get_option(TYAJ_OPT, array());
	$s = wp_parse_args(is_array($saved) ? $saved : array(), tyaj_defaults());
	$s['form_secret'] = tyaj_secret();
	return $s;
}

// The form secret lives in its own option so it is created once and never touched by the settings form.
function tyaj_secret($regenerate = false) {
	$secret = get_option('tyaj_form_secret');
	if (!$secret || $regenerate) {
		$secret = wp_generate_password(40, false);
		update_option('tyaj_form_secret', $secret, false);
	}
	return $secret;
}

function tyaj_parse_stations($text) {
	$out = array();
	foreach (preg_split('/\r\n|\r|\n/', (string) $text) as $line) {
		$line = trim($line);
		if ($line === '' || strpos($line, '#') === 0) { continue; }
		$p = array_map('trim', explode('|', $line));
		if (count($p) < 4) { continue; }
		$out[] = array(
			'name' => $p[0], 'genre' => $p[1], 'description' => $p[2],
			'site' => esc_url_raw($p[3]), 'stream' => isset($p[4]) ? esc_url_raw($p[4]) : '',
		);
	}
	return $out;
}

/* ---------------------------------------------------------------
 * Admin: Site Settings screen
 * ------------------------------------------------------------- */

add_action('admin_menu', function () {
	add_menu_page('Site Settings', 'Site Settings', 'manage_options', 'tyaj-settings', 'tyaj_settings_page', 'dashicons-admin-site-alt3', 3);
});

add_action('admin_init', function () {
	register_setting('tyaj', TYAJ_OPT, array('sanitize_callback' => 'tyaj_sanitize'));
});

function tyaj_sanitize($in) {
	$old = tyaj_get();
	$out = $old;
	unset($out['form_secret']);
	$out['hero_title']   = sanitize_text_field($in['hero_title'] ?? '');
	$out['hero_text']    = sanitize_textarea_field($in['hero_text'] ?? '');
	$out['logo_id']      = absint($in['logo_id'] ?? 0);
	$out['notice_title'] = sanitize_text_field($in['notice_title'] ?? '');
	$out['notice_text']  = sanitize_textarea_field($in['notice_text'] ?? '');
	$out['notice_date']  = sanitize_text_field($in['notice_date'] ?? '');
	$out['notice_link']  = sanitize_text_field($in['notice_link'] ?? '');
	$sp = array();
	for ($i = 0; $i < 7; $i++) {
		$row = $in['spirits'][$i] ?? array();
		$sp[] = array(
			'name'    => sanitize_text_field($row['name'] ?? ''),
			'verse'   => sanitize_textarea_field($row['verse'] ?? ''),
			'ref'     => sanitize_text_field($row['ref'] ?? ''),
			'meaning' => sanitize_textarea_field($row['meaning'] ?? ''),
		);
	}
	$out['spirits']      = $sp;
	$out['stations']     = sanitize_textarea_field($in['stations'] ?? '');
	$out['public_url']   = esc_url_raw(untrailingslashit($in['public_url'] ?? ''));
	$out['deploy_hook']  = esc_url_raw($in['deploy_hook'] ?? '');
	$out['notify_email'] = sanitize_email($in['notify_email'] ?? '');
	foreach (array('partnerships_email', 'press_email', 'licensing_email', 'store_email') as $k) { $out[$k] = sanitize_email($in[$k] ?? ''); }
	if (!empty($in['regen_secret'])) { tyaj_secret(true); }
	return $out;
}

add_action('admin_enqueue_scripts', function ($hook) {
	if ($hook === 'toplevel_page_tyaj-settings' || in_array($hook, array('edit-tags.php', 'term.php'), true)) {
		wp_enqueue_media();
	}
});

function tyaj_media_picker_js() { ?>
	<script>
	document.addEventListener('click', function (e) {
		var pick = e.target.closest('[data-tyaj-pick]'), clear = e.target.closest('[data-tyaj-clear]');
		if (pick) {
			e.preventDefault();
			var box = pick.closest('.tyaj-media'), frame = wp.media({ title: 'Choose an image', button: { text: 'Use this image' }, multiple: false, library: { type: 'image' } });
			frame.on('select', function () {
				var a = frame.state().get('selection').first().toJSON();
				box.querySelector('input').value = a.id;
				box.querySelector('img').src = (a.sizes && a.sizes.medium ? a.sizes.medium.url : a.url);
				box.querySelector('img').style.display = 'block';
			});
			frame.open();
		}
		if (clear) {
			e.preventDefault();
			var b = clear.closest('.tyaj-media'); b.querySelector('input').value = ''; b.querySelector('img').style.display = 'none';
		}
	});
	</script>
<?php }

function tyaj_media_field($name, $id) {
	$url = $id ? wp_get_attachment_image_url($id, 'medium') : '';
	printf(
		'<div class="tyaj-media"><img src="%s" style="max-width:180px;height:auto;border-radius:8px;margin-bottom:8px;%s" alt=""><br><input type="hidden" name="%s" value="%s"><button class="button" data-tyaj-pick>Choose image</button> <button class="button-link" data-tyaj-clear>Remove</button></div>',
		esc_url($url), $url ? 'display:block' : 'display:none', esc_attr($name), esc_attr($id ?: '')
	);
}

function tyaj_settings_page() {
	if (!current_user_can('manage_options')) { return; }
	$s = tyaj_get();
	$n = TYAJ_OPT;
	$spiritNames = array('Knowledge', 'Understanding', 'Wisdom', 'Our Lord Jesus Christ', 'Counsel', 'Might', 'Reverent Fear of our Lord');
	?>
	<div class="wrap">
		<h1>Site Settings</h1>
		<p>These control parts of the homepage on ThereYouAreJesus.com. Leave a field empty to keep the current wording. After you save, the site updates in about two minutes.</p>
		<form method="post" action="options.php">
			<?php settings_fields('tyaj'); ?>

			<h2>Logo</h2>
			<table class="form-table"><tr><th>Site logo</th><td><?php tyaj_media_field($n . '[logo_id]', (int) $s['logo_id']); ?><p class="description">Shown in the header, footer, podcast player and browser tab. A square PNG works best.</p></td></tr></table>

			<h2>Homepage introduction</h2>
			<table class="form-table">
				<tr><th><label for="t-ht">Headline</label></th><td><input id="t-ht" class="large-text" name="<?php echo esc_attr($n); ?>[hero_title]" value="<?php echo esc_attr($s['hero_title']); ?>"></td></tr>
				<tr><th><label for="t-hx">Introduction</label></th><td><textarea id="t-hx" class="large-text" rows="3" name="<?php echo esc_attr($n); ?>[hero_text]"><?php echo esc_textarea($s['hero_text']); ?></textarea></td></tr>
			</table>

			<h2>Announcement panel</h2>
			<p>The dark box beside Latest Evidence. Use it for timeline updates or anything new.</p>
			<table class="form-table">
				<tr><th><label for="t-nd">Small line on top</label></th><td><input id="t-nd" class="regular-text" placeholder="Updated September 29, 2026" name="<?php echo esc_attr($n); ?>[notice_date]" value="<?php echo esc_attr($s['notice_date']); ?>"></td></tr>
				<tr><th><label for="t-nt">Title</label></th><td><input id="t-nt" class="large-text" name="<?php echo esc_attr($n); ?>[notice_title]" value="<?php echo esc_attr($s['notice_title']); ?>"></td></tr>
				<tr><th><label for="t-nx">Text</label></th><td><textarea id="t-nx" class="large-text" rows="2" name="<?php echo esc_attr($n); ?>[notice_text]"><?php echo esc_textarea($s['notice_text']); ?></textarea></td></tr>
				<tr><th><label for="t-nl">Link</label></th><td><input id="t-nl" class="regular-text" placeholder="/2026/09/post-name/" name="<?php echo esc_attr($n); ?>[notice_link]" value="<?php echo esc_attr($s['notice_link']); ?>"><p class="description">Paste the post's address. The part after the domain is enough.</p></td></tr>
			</table>

			<h2>The Seven Spirits</h2>
			<p>Shown when someone selects a spirit on the homepage. Scripture is quoted from the King James Version.</p>
			<table class="form-table">
			<?php for ($i = 0; $i < 7; $i++) : $row = $s['spirits'][$i] ?? array(); $b = $n . '[spirits][' . $i . ']'; ?>
				<tr><th><?php echo esc_html(($i + 1) . '. ' . $spiritNames[$i]); ?></th><td>
					<p><label>Name<br><input class="regular-text" name="<?php echo esc_attr($b); ?>[name]" placeholder="<?php echo esc_attr($spiritNames[$i]); ?>" value="<?php echo esc_attr($row['name'] ?? ''); ?>"></label></p>
					<p><label>Verse<br><textarea class="large-text" rows="2" name="<?php echo esc_attr($b); ?>[verse]"><?php echo esc_textarea($row['verse'] ?? ''); ?></textarea></label></p>
					<p><label>Reference<br><input class="regular-text" placeholder="Isaiah 11:2" name="<?php echo esc_attr($b); ?>[ref]" value="<?php echo esc_attr($row['ref'] ?? ''); ?>"></label></p>
					<p><label>What it means<br><textarea class="large-text" rows="2" name="<?php echo esc_attr($b); ?>[meaning]"><?php echo esc_textarea($row['meaning'] ?? ''); ?></textarea></label></p>
				</td></tr>
			<?php endfor; ?>
			</table>

			<h2>Live radio stations</h2>
			<table class="form-table"><tr><th><label for="t-st">Stations</label></th><td>
				<textarea id="t-st" class="large-text code" rows="10" name="<?php echo esc_attr($n); ?>[stations]"><?php echo esc_textarea($s['stations']); ?></textarea>
				<p class="description">One station per line: <code>Name | Genre | Short description | Website | Stream URL</code>. Leave the stream URL off to link to the station's own player. Leave this box empty to use the built-in list.</p>
			</td></tr></table>

			<h2>Connection</h2>
			<p>Set up once. You likely won't need to change these again.</p>
			<table class="form-table">
				<tr><th><label for="t-pu">Public site address</label></th><td><input id="t-pu" class="regular-text" placeholder="https://thereyouarejesus.com" name="<?php echo esc_attr($n); ?>[public_url]" value="<?php echo esc_attr($s['public_url']); ?>"><p class="description">Once WordPress moves to its own address (like cms.thereyouarejesus.com), visitors who land on WordPress pages are sent to this address instead.</p></td></tr>
				<tr><th><label for="t-dh">Vercel deploy hook</label></th><td><input id="t-dh" class="large-text code" name="<?php echo esc_attr($n); ?>[deploy_hook]" value="<?php echo esc_attr($s['deploy_hook']); ?>"><p class="description">From Vercel: Project Settings, Git, Deploy Hooks. The site rebuilds whenever a post, page, category or these settings change.</p></td></tr>
				<tr><th>Form secret</th><td><code style="user-select:all"><?php echo esc_html($s['form_secret']); ?></code><p class="description">Copy this into Vercel as the <code>TYAJ_FORM_SECRET</code> environment variable.</p><label><input type="checkbox" name="<?php echo esc_attr($n); ?>[regen_secret]" value="1"> Create a new secret when I save</label></td></tr>
				<tr><th><label for="t-ne">Send messages to</label></th><td><input id="t-ne" type="email" class="regular-text" name="<?php echo esc_attr($n); ?>[notify_email]" value="<?php echo esc_attr($s['notify_email']); ?>"><p class="description">Share Your Thoughts messages are saved under Messages and emailed here.</p></td></tr>
				<tr><th><label for="t-pe">Partnership inquiries</label></th><td><input id="t-pe" type="email" class="regular-text" name="<?php echo esc_attr($n); ?>[partnerships_email]" value="<?php echo esc_attr($s['partnerships_email']); ?>"></td></tr>
				<tr><th><label for="t-pr">Press requests</label></th><td><input id="t-pr" type="email" class="regular-text" name="<?php echo esc_attr($n); ?>[press_email]" value="<?php echo esc_attr($s['press_email']); ?>"></td></tr>
				<tr><th><label for="t-li">Licensing requests</label></th><td><input id="t-li" type="email" class="regular-text" name="<?php echo esc_attr($n); ?>[licensing_email]" value="<?php echo esc_attr($s['licensing_email']); ?>"><p class="description">These forms are also saved under Messages.</p></td></tr>
				<tr><th><label for="t-so">Store orders</label></th><td><input id="t-so" type="email" class="regular-text" name="<?php echo esc_attr($n); ?>[store_email]" value="<?php echo esc_attr($s['store_email']); ?>"><p class="description">Who prepares and ships orders. Leave empty to use the address above.</p></td></tr>
			</table>
			<?php submit_button('Save and update the site'); ?>
		</form>
		<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
			<input type="hidden" name="action" value="tyaj_rebuild"><?php wp_nonce_field('tyaj_rebuild'); ?>
			<p><button class="button">Rebuild the site now</button> <span class="description">Use this if a change hasn't appeared after a few minutes.</span></p>
		</form>
	</div>
	<?php tyaj_media_picker_js();
}

add_action('admin_post_tyaj_rebuild', function () {
	if (!current_user_can('manage_options') || !check_admin_referer('tyaj_rebuild')) { wp_die('Not allowed.'); }
	tyaj_trigger_deploy(true);
	wp_safe_redirect(add_query_arg('tyaj_rebuilt', '1', admin_url('admin.php?page=tyaj-settings')));
	exit;
});

add_action('admin_notices', function () {
	if (isset($_GET['page'], $_GET['tyaj_rebuilt']) && $_GET['page'] === 'tyaj-settings') {
		echo '<div class="notice notice-success is-dismissible"><p>Rebuild started. The site will update in about two minutes.</p></div>';
	}
});

/* ---------------------------------------------------------------
 * Category images
 * ------------------------------------------------------------- */

add_action('category_add_form_fields', function () {
	echo '<div class="form-field"><label>Category image</label>';
	tyaj_media_field('tyaj_image', 0);
	echo '<p>Shown on the homepage in the Evidence section.</p></div>';
	tyaj_media_picker_js();
});
add_action('category_edit_form_fields', function ($term) {
	$id = (int) get_term_meta($term->term_id, 'tyaj_image', true);
	echo '<tr class="form-field"><th scope="row">Category image</th><td>';
	tyaj_media_field('tyaj_image', $id);
	echo '<p class="description">Shown on the homepage in the Evidence section. Eyewitness Afterlife works best with a wide image.</p></td></tr>';
	tyaj_media_picker_js();
});
$tyaj_save_term = function ($term_id) {
	if (!current_user_can('manage_categories') || !isset($_POST['tyaj_image'])) { return; }
	$id = absint($_POST['tyaj_image']);
	if ($id) { update_term_meta($term_id, 'tyaj_image', $id); } else { delete_term_meta($term_id, 'tyaj_image'); }
};
add_action('created_category', $tyaj_save_term);
add_action('edited_category', $tyaj_save_term);

/* ---------------------------------------------------------------
 * REST API
 * ------------------------------------------------------------- */

add_action('rest_api_init', function () {
	register_rest_field('category', 'tyaj_image_url', array(
		'get_callback' => function ($term) {
			$id = (int) get_term_meta($term['id'], 'tyaj_image', true);
			return $id ? (wp_get_attachment_image_url($id, 'large') ?: '') : '';
		},
		'schema' => array('type' => 'string'),
	));

	register_rest_route('tyaj/v1', '/settings', array(
		'methods' => 'GET',
		'permission_callback' => '__return_true',
		'callback' => function () {
			$s = tyaj_get();
			$logo = $s['logo_id'] ? wp_get_attachment_image_url($s['logo_id'], 'medium') : '';
			if (!$logo && get_option('site_icon')) { $logo = wp_get_attachment_image_url(get_option('site_icon'), 'full'); }
			$spirits = array();
			foreach ($s['spirits'] as $row) { $spirits[] = array_filter((array) $row, 'strlen'); }
			return array(
				'hero_title' => $s['hero_title'],
				'hero_text'  => $s['hero_text'],
				'logo_url'   => $logo ?: '',
				'notice'     => array_filter(array('title' => $s['notice_title'], 'text' => $s['notice_text'], 'date' => $s['notice_date'], 'link' => $s['notice_link']), 'strlen'),
				'spirits'    => $spirits,
				'stations'   => tyaj_parse_stations($s['stations']),
			);
		},
	));

	register_rest_route('tyaj/v1', '/message', array(
		'methods' => 'POST',
		'permission_callback' => function (WP_REST_Request $r) {
			$s = tyaj_get();
			return !empty($s['form_secret']) && hash_equals($s['form_secret'], (string) $r->get_header('x-tyaj-secret'));
		},
		'callback' => 'tyaj_receive_message',
	));
});

/* ---------------------------------------------------------------
 * Messages inbox (Share Your Thoughts)
 * ------------------------------------------------------------- */

function tyaj_topic_label($k) {
	$t = array('question' => 'Question', 'story' => 'Experience', 'guest' => 'Podcast guest', 'prayer' => 'Prayer request', 'feedback' => 'Response to a post', 'partnership' => 'Partnership inquiry', 'press' => 'Press request', 'licensing' => 'Licensing request', 'order' => 'Store order');
	return $t[$k] ?? ucfirst($k);
}

add_action('init', function () {
	register_post_type('tyaj_message', array(
		'labels' => array('name' => 'Messages', 'singular_name' => 'Message', 'menu_name' => 'Messages', 'all_items' => 'All messages', 'edit_item' => 'Message', 'search_items' => 'Search messages', 'not_found' => 'No messages yet.'),
		'public' => false, 'show_ui' => true, 'show_in_menu' => true, 'menu_position' => 4, 'menu_icon' => 'dashicons-email-alt',
		'supports' => array('title', 'editor'), 'capability_type' => 'post', 'map_meta_cap' => true,
		'capabilities' => array('create_posts' => 'do_not_allow'), 'show_in_rest' => false,
	));
});

function tyaj_receive_message(WP_REST_Request $r) {
	$d = $r->get_json_params();
	$topic = sanitize_key($d['topic'] ?? '');
	$name  = sanitize_text_field($d['name'] ?? '');
	$email = sanitize_email($d['email'] ?? '');
	$body  = sanitize_textarea_field($d['message'] ?? '');
	if (!$topic || !$name || !is_email($email) || !$body) {
		return new WP_Error('tyaj_invalid', 'Missing required fields.', array('status' => 400));
	}
	$id = wp_insert_post(array(
		'post_type' => 'tyaj_message', 'post_status' => 'private',
		'post_title' => tyaj_topic_label($topic) . ' from ' . $name, 'post_content' => $body,
	), true);
	if (is_wp_error($id)) { return $id; }
	$meta = array(
		'topic' => $topic, 'name' => $name, 'email' => $email,
		'location' => sanitize_text_field($d['location'] ?? ''), 'kind' => sanitize_text_field($d['kind'] ?? ''),
		'when' => sanitize_text_field($d['when'] ?? ''), 'phone' => sanitize_text_field($d['phone'] ?? ''),
		'record' => !empty($d['record']) ? 'yes' : '', 'post' => sanitize_text_field($d['post'] ?? ''),
		'perm' => sanitize_key($d['perm'] ?? 'private'), 'subscribe' => !empty($d['subscribe']) ? 'yes' : '',
		'organization' => sanitize_text_field($d['organization'] ?? ''), 'org_url' => esc_url_raw($d['org_url'] ?? ''),
		'deadline' => sanitize_text_field($d['deadline'] ?? ''),
	);
	foreach ($meta as $k => $v) { update_post_meta($id, '_tyaj_' . $k, $v); }

	$s = tyaj_get();
	$route = array('partnership' => 'partnerships_email', 'press' => 'press_email', 'licensing' => 'licensing_email', 'order' => 'store_email');
	$to = (isset($route[$topic]) && !empty($s[$route[$topic]])) ? $s[$route[$topic]] : ($s['notify_email'] ?: get_option('admin_email'));
	$lines = array(tyaj_topic_label($topic) . ' from ' . $name . ' <' . $email . '>', '');
	$labels = array('organization' => 'Organization', 'org_url' => 'Website', 'deadline' => 'Deadline', 'location' => 'From', 'kind' => 'Type', 'when' => 'When', 'phone' => 'Phone', 'record' => 'Open to recording', 'post' => 'About the post', 'perm' => 'Sharing permission', 'subscribe' => 'Wants new posts by email');
	foreach ($labels as $k => $label) { if ($meta[$k] !== '') { $lines[] = $label . ': ' . $meta[$k]; } }
	$lines[] = ''; $lines[] = $body; $lines[] = ''; $lines[] = 'View in WordPress: ' . admin_url('post.php?post=' . $id . '&action=edit');
	wp_mail($to, 'New message on ThereYouAreJesus: ' . tyaj_topic_label($topic), implode("\n", $lines), array('Reply-To: ' . $name . ' <' . $email . '>'));

	return array('ok' => true);
}

add_action('add_meta_boxes_tyaj_message', function () {
	add_meta_box('tyaj_details', 'Details', function ($post) {
		$f = array('topic' => 'Topic', 'name' => 'Name', 'email' => 'Email', 'organization' => 'Organization', 'org_url' => 'Website', 'deadline' => 'Deadline', 'location' => 'From', 'kind' => 'Type', 'when' => 'When it happened', 'phone' => 'Phone', 'record' => 'Open to recording', 'post' => 'About the post', 'perm' => 'Can we share it?', 'subscribe' => 'Wants new posts by email');
		echo '<table class="widefat striped"><tbody>';
		foreach ($f as $k => $label) {
			$v = get_post_meta($post->ID, '_tyaj_' . $k, true);
			if ($v === '') { continue; }
			if ($k === 'topic') { $v = tyaj_topic_label($v); }
			if ($k === 'perm') { $v = array('first-name' => 'Yes, with first name', 'anonymous' => 'Yes, anonymously', 'private' => 'No, keep private')[$v] ?? $v; }
			if ($k === 'email') { $v = '<a href="mailto:' . esc_attr($v) . '">' . esc_html($v) . '</a>'; } else { $v = esc_html($v); }
			echo '<tr><th style="width:200px">' . esc_html($label) . '</th><td>' . $v . '</td></tr>';
		}
		echo '</tbody></table>';
	}, 'tyaj_message', 'normal', 'high');
});

add_filter('manage_tyaj_message_posts_columns', function ($c) {
	return array('cb' => $c['cb'], 'title' => 'Message', 'tyaj_email' => 'Email', 'tyaj_perm' => 'Can we share it?', 'date' => 'Received');
});
add_action('manage_tyaj_message_posts_custom_column', function ($col, $id) {
	if ($col === 'tyaj_email') { echo esc_html(get_post_meta($id, '_tyaj_email', true)); }
	if ($col === 'tyaj_perm') {
		$v = get_post_meta($id, '_tyaj_perm', true);
		echo esc_html(array('first-name' => 'First name', 'anonymous' => 'Anonymously', 'private' => 'Private')[$v] ?? '');
	}
}, 10, 2);

/* ---------------------------------------------------------------
 * Rebuild the public site when content changes
 * ------------------------------------------------------------- */

function tyaj_trigger_deploy($force = false) {
	$s = tyaj_get();
	if (empty($s['deploy_hook'])) { return; }
	// Several saves in a row (common in the editor) only start one rebuild per 30 seconds.
	if (!$force && get_transient('tyaj_deploy_lock')) { return; }
	set_transient('tyaj_deploy_lock', 1, 30);
	wp_remote_post($s['deploy_hook'], array('blocking' => false, 'timeout' => 5));
}

add_action('transition_post_status', function ($new, $old, $post) {
	if (!in_array($post->post_type, array('post', 'page'), true)) { return; }
	if ($new === 'publish' || $old === 'publish') {
		if (wp_is_post_revision($post->ID) || wp_is_post_autosave($post->ID)) { return; }
		// A delayed second call catches edits saved moments after the first rebuild started.
		tyaj_trigger_deploy();
		if (!wp_next_scheduled('tyaj_delayed_deploy')) { wp_schedule_single_event(time() + 90, 'tyaj_delayed_deploy'); }
	}
}, 10, 3);
add_action('tyaj_delayed_deploy', function () { tyaj_trigger_deploy(true); });
add_action('deleted_post', function ($id, $post = null) {
	if ($post && in_array($post->post_type, array('post', 'page'), true) && $post->post_status === 'publish') { tyaj_trigger_deploy(true); }
}, 10, 2);
add_action('created_category', function () { tyaj_trigger_deploy(); }, 20);
add_action('edited_category', function () { tyaj_trigger_deploy(); }, 20);
add_action('delete_category', function () { tyaj_trigger_deploy(); }, 20);
add_action('update_option_' . TYAJ_OPT, function () { tyaj_trigger_deploy(true); });

/* ---------------------------------------------------------------
 * Send visitors from WordPress pages to the public site
 * ------------------------------------------------------------- */

add_action('template_redirect', function () {
	if (is_admin() || wp_doing_ajax() || is_preview() || (defined('REST_REQUEST') && REST_REQUEST) || is_user_logged_in()) { return; }
	// "Visit the previous version" link on the new site: let the visitor browse the classic site for 30 days.
	if (isset($_GET['classic'])) { setcookie('tyaj_classic', '1', time() + 30 * DAY_IN_SECONDS, COOKIEPATH ?: '/', COOKIE_DOMAIN, is_ssl(), true); return; }
	if (!empty($_COOKIE['tyaj_classic'])) { return; }
	$s = tyaj_get();
	if (empty($s['public_url'])) { return; }
	$target = wp_parse_url($s['public_url'], PHP_URL_HOST);
	$here = isset($_SERVER['HTTP_HOST']) ? strtolower(sanitize_text_field(wp_unslash($_SERVER['HTTP_HOST']))) : '';
	if (!$target || strtolower($target) === $here) { return; } // Still on the main domain: do nothing.
	$path = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
	wp_redirect($s['public_url'] . $path, 301);
	exit;
});

// Keep the WordPress copy out of search results once it lives on its own address.
add_filter('wp_robots', function ($robots) {
	$s = tyaj_get();
	$target = $s['public_url'] ? wp_parse_url($s['public_url'], PHP_URL_HOST) : '';
	$here = isset($_SERVER['HTTP_HOST']) ? strtolower(sanitize_text_field(wp_unslash($_SERVER['HTTP_HOST']))) : '';
	if ($target && strtolower($target) !== $here) { $robots['noindex'] = true; $robots['nofollow'] = true; }
	return $robots;
});

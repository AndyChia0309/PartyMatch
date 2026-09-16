export const NOTIFICATION_CATEGORIES = {
  application_sent:      'application',
  application_approved:  'application',
  application_rejected:  'application',
  application_cancelled: 'application',
  new_application:       'application',

  group_created:            'group',
  group_activated:          'group',
  group_chat_opened:        'group',
  group_full:                'group',
  group_full_member:         'group',
  group_ended:               'group',
  group_cancelled:           'group',
  group_renewal:             'group',
  member_left:               'group',
  member_removed:            'group',
  member_confirmed_service:  'group',
  group_reviewed:            'group',

  fill_service_info:             'billing',
  service_info_filled:           'billing',
  credential_extraction_started: 'billing',
  all_service_info_filled:       'billing',
  group_activation_expired:      'billing',
  service_info_deadline_passed:  'billing',
  escrow_released:               'billing',
  escrow_released_member:        'billing',
  upcoming_renewal:              'billing',
  billing_date_confirmed:        'billing',
  billing_date_adjusted:         'billing',
  payment_reminder:              'billing',
};

export const MUTABLE_NOTIFICATION_CATEGORY_KEYS = ['application', 'group', 'billing'];

export const ALWAYS_SEND_NOTIFICATION_TYPES = [
  'dispute_raised',
  'dispute_resolved',
  'dispute_resolved_by_host',
  'dispute_withdrawn',
  'service_info_issue',
  'account_reactivated',
  'system',
];

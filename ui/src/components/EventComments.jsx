import { useState, useEffect } from 'react';
import { eventsAPI } from '../services/api';

function EventComments({ eventId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadComments();
  }, [eventId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await eventsAPI.getComments(eventId);
      setComments(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await eventsAPI.addComment(eventId, {
        comment: newComment,
        rating: newRating
      });
      setNewComment('');
      setNewRating(5);
      setShowForm(false);
      loadComments();
    } catch (err) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStars = (rating, interactive = false, onChange = null) => {
    return (
      <div style={{display: 'flex', gap: '4px'}}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={interactive && onChange ? () => onChange(star) : undefined}
            style={{
              fontSize: '1.25rem',
              cursor: interactive ? 'pointer' : 'default',
              background: 'none',
              border: 'none',
              padding: 0,
              transition: 'transform 0.2s'
            }}
            disabled={!interactive}
          >
            {star <= rating ? '⭐' : '☆'}
          </button>
        ))}
      </div>
    );
  };

  const averageRating = comments.length > 0
    ? (comments.reduce((sum, c) => sum + c.rating, 0) / comments.length).toFixed(1)
    : null;

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    padding: '24px',
    marginTop: '24px'
  };

  const btnPrimary = {
    padding: '10px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  const btnSuccess = {
    padding: '10px 24px',
    backgroundColor: '#16a34a',
    color: 'white',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'none',
    boxSizing: 'border-box'
  };

  if (loading) {
    return (
      <div style={{padding: '24px', textAlign: 'center', color: '#6b7280'}}>
        Loading comments...
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px'}}>
        <div>
          <h3 style={{fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '4px'}}>💬 Reviews & Comments</h3>
          {averageRating && (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
              {renderStars(Math.round(parseFloat(averageRating)))}
              <span style={{fontSize: '14px', color: '#6b7280'}}>
                {averageRating} avg ({comments.length} review{comments.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>
        <button onClick={() => setShowForm(!showForm)} style={btnPrimary}>
          {showForm ? 'Cancel' : '✏️ Write Review'}
        </button>
      </div>

      {error && (
        <div style={{backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', color: '#b91c1c', fontSize: '14px', marginBottom: '16px'}}>
          {error}
        </div>
      )}

      {/* New Comment Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{backgroundColor: '#f9fafb', borderRadius: '10px', padding: '20px', marginBottom: '24px'}}>
          <div style={{marginBottom: '16px'}}>
            <label style={{display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px'}}>
              Your Rating
            </label>
            {renderStars(newRating, true, setNewRating)}
          </div>
          <div style={{marginBottom: '16px'}}>
            <label style={{display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px'}}>
              Your Comment
            </label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your experience with this event..."
              rows={4}
              style={inputStyle}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            style={{...btnSuccess, opacity: (submitting || !newComment.trim()) ? 0.5 : 1}}
          >
            {submitting ? 'Posting...' : 'Post Review'}
          </button>
        </form>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div style={{textAlign: 'center', padding: '32px 0', color: '#6b7280'}}>
          <p>No reviews yet. Be the first to share your experience!</p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          {comments.map((comment, index) => (
            <div key={comment.id} style={{borderBottom: index < comments.length - 1 ? '1px solid #f3f4f6' : 'none', paddingBottom: '16px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px'}}>
                <div>
                  <span style={{fontWeight: '500', color: '#1f2937'}}>{comment.user_name}</span>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'}}>
                    {renderStars(comment.rating)}
                  </div>
                </div>
                <span style={{fontSize: '12px', color: '#9ca3af'}}>
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p style={{color: '#6b7280', marginTop: '8px'}}>{comment.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventComments;
